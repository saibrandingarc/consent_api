import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Body, Controller, Get, Header, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Repositories } from '@cmp/database';
import { DOMAIN_CONFIG } from '@cmp/config';
import { sdkConsentSubmissionSchema, sdkHeartbeatSchema, blockingViolationReportSchema, consentGroupSyncSchema } from '@cmp/validation';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { REPOS } from '../database/database.module';
import { ConsentService } from '../consent/consent.service';
import { BlockingService } from '../blocking/blocking.service';
import { GeoRegulationService } from '../geo/geo-regulation.service';
import { buildVendorPatterns } from '../blocking/vendor-patterns.util';
import { buildConsentRecordPayload } from '../consent-records/consent-record.factory';
import { deriveSharedCookieDomain, applyRegulationProfile, getRegulationProfile, extractClientIp, lookupCountryFromIp } from '@cmp/utils';
import {
  createVisitorVerificationToken,
  signConsentToken,
  verifyConsentToken,
} from './consent-token';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';
import { EnterpriseService } from '../enterprise/enterprise.service';

function mapConsentWebhookEvent(collectionMethod: string, hadPrevious: boolean) {
  if (collectionMethod === 'withdrawal') return 'consent.withdrawn';
  if (hadPrevious) return 'consent.updated';
  return 'consent.created';
}

function requiresVerification(domain: {
  isProduction: boolean;
  environment: string;
  verificationStatus: string;
}) {
  return (
    domain.isProduction &&
    domain.environment === 'production' &&
    domain.verificationStatus !== 'VERIFIED'
  );
}

function loadSdkBundle() {
  try {
    const sdkPath = require.resolve('@cmp/sdk/dist/sdk.js');
    return readFileSync(sdkPath, 'utf8');
  } catch {
    return "console.error('[CMP] SDK bundle not found. Run pnpm --filter @cmp/sdk build');";
  }
}

@Controller('public/cmp')
export class PublicCmpController {
  constructor(
    @Inject(REPOS) private readonly repos: Repositories,
    private readonly consentService: ConsentService,
    private readonly blockingService: BlockingService,
    private readonly geoRegulationService: GeoRegulationService,
    private readonly webhookDelivery: WebhookDeliveryService,
    private readonly enterpriseService: EnterpriseService,
  ) {}

  @Public()
  @Get('config/:domainKey')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  async getConfig(
    @Param('domainKey') domainKey: string,
    @Query('previewCountry') previewCountry?: string,
    @Query('previewRegion') previewRegion?: string,
    @Query('previewProfileId') previewProfileId?: string,
    @Query('clientCountry') clientCountry?: string,
    @Query('clientLanguage') clientLanguage?: string,
    @Query('clientTimezone') clientTimezone?: string,
    @Query('clientRegion') clientRegion?: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<unknown> {
    const domain = await this.repos.domains.findByDomainKey(domainKey);
    if (!domain || !domain.enabled) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } };
    }

    if (requiresVerification(domain)) {
      return {
        ok: false,
        error: {
          code: 'DOMAIN_NOT_VERIFIED',
          message: 'Production configuration is unavailable until domain ownership is verified',
        },
      };
    }

    const consentConfig = await this.consentService.getPublishedConfig(domain.id);
    const organization = await this.repos.organizations.findById(domain.organizationId);
    const cookieDefinitions = await this.repos.cookies.listDefinitions(domain.organizationId);
    const vendorPatterns = buildVendorPatterns(cookieDefinitions);

    const legalText = (consentConfig?.legalText ?? null) as { defaultLanguage?: string } | null;
    const supportedLanguages = (consentConfig?.supportedLanguages as string[] | null) ?? ['en'];
    const defaultLanguage = legalText?.defaultLanguage ?? supportedLanguages[0] ?? 'en';

    const categories = (consentConfig?.categories ?? []) as Array<{
      slug: string;
      defaultState?: string;
      enabled?: boolean;
    }>;
    const banner = (consentConfig?.banner ?? null) as Record<string, unknown> | null;

    const clientIp = extractClientIp(req?.headers ?? {});
    const ipGeo = await lookupCountryFromIp(clientIp);

    const geoResult = this.geoRegulationService.resolve({
      headers: req?.headers ?? {},
      domainRegion: domain.region,
      geoTargetingDisabled: organization?.geoTargetingDisabled ?? false,
      previewCountry: previewCountry ?? undefined,
      previewRegion: previewRegion ?? undefined,
      ipGeo: ipGeo ? { country: ipGeo.country, region: ipGeo.region } : null,
      clientHints: {
        country: clientCountry ?? null,
        region: clientRegion ?? null,
        language: clientLanguage ?? 'en',
        timezone: clientTimezone ?? null,
      },
      regulationConfig: (consentConfig?.regulationConfig as Record<string, unknown>) ?? null,
      orgDefaultRegulation: organization?.defaultRegulation ?? null,
      banner,
      categories,
    });

    if (previewProfileId) {
      const profile = getRegulationProfile(previewProfileId);
      const applied = applyRegulationProfile(banner, categories, profile, null);
      geoResult.banner = applied.banner;
      geoResult.categories = applied.categories;
      geoResult.regulationProfileId = profile.id;
      geoResult.applicableRegulation = profile.regulation;
    }

    res?.setHeader('ETag', `"${domain.configVersion}"`);

    const shareVisitorAcrossSubdomains = Boolean(domain.groupName);
    const visitorCookieDomain = shareVisitorAcrossSubdomains
      ? deriveSharedCookieDomain(domain.hostname)
      : null;

    const crossDomainGroup = await this.enterpriseService.buildCrossDomainGroupPayload(domain.id);
    const whiteLabel = this.enterpriseService.buildPublicWhiteLabel(organization);

    return ok({
      domainKey: domain.domainKey,
      hostname: domain.hostname,
      configVersion: domain.configVersion,
      environment: domain.environment,
      region: geoResult.region ?? domain.region,
      visitorGeo: geoResult.visitorGeo,
      applicableRegulation: geoResult.applicableRegulation,
      regulationProfileId: geoResult.regulationProfileId,
      matchedRegionalRuleId: geoResult.matchedRuleId,
      shareVisitorAcrossSubdomains,
      visitorCookieDomain,
      autoBlocking: domain.autoBlocking,
      debugMode: domain.debugMode,
      vendorPatterns,
      verified: domain.verificationStatus === 'VERIFIED',
      policyVersionId: consentConfig?.policyVersionId ?? null,
      policyVersionNumber: consentConfig?.versionNumber ?? null,
      requiresRenewal: consentConfig?.requiresRenewal ?? false,
      categories: geoResult.categories ?? [],
      banner: geoResult.banner ?? null,
      legalText: consentConfig?.legalText ?? null,
      regulationConfig: consentConfig?.regulationConfig ?? null,
      defaultConsentStates: consentConfig?.defaultConsentStates ?? null,
      supportedLanguages,
      defaultLanguage,
      crossDomainGroup,
      whiteLabel,
    });
  }

  @Public()
  @Post('consent/group-sync')
  async groupConsentSync(
    @Body(new ZodValidationPipe(consentGroupSyncSchema))
    body: { domainKey: string; visitorId: string; groupId: string },
  ) {
    return this.enterpriseService.syncGroupConsent(body.domainKey, body.visitorId, body.groupId);
  }

  @Public()
  @Get('cookie-declaration/:domainKey')
  async cookieDeclaration(
    @Param('domainKey') domainKey: string,
    @Query('language') _language?: string,
  ) {
    const domain = await this.repos.domains.findByDomainKey(domainKey);
    if (!domain) {
      return { ok: false, error: { code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' } };
    }

    const all = await this.repos.cookies.listByDomain(domain.id);
    const cookies = all
      .filter((c) => c.reviewStatus === 'APPROVED' || c.reviewStatus === 'AUTO_MATCHED')
      .map((c) => ({
        cookieName: c.cookieName,
        cookieDomain: c.cookieDomain,
        provider: c.provider,
        purpose: c.purpose,
        category: c.category,
        duration: c.duration,
        isThirdParty: c.isThirdParty,
        privacyPolicyUrl: c.privacyPolicyUrl,
        description: c.description,
      }));

    return ok({ cookies });
  }

  @Public()
  @Get('verify/:domainKey.html')
  @Header('Content-Type', 'text/html')
  async verifyHtml(@Param('domainKey') domainKey: string, @Res() res: Response) {
    const domain = await this.repos.domains.findByDomainKey(domainKey);
    if (!domain) {
      res.status(404).send('Not found');
      return;
    }
    res.send(domain.verificationToken);
  }

  @Public()
  @Post('consent')
  async submitConsent(
    @Body(new ZodValidationPipe(sdkConsentSubmissionSchema))
    body: {
      domainKey: string;
      visitorId: string;
      policyVersionId?: string | null;
      configVersion: number;
      categories: Record<string, boolean>;
      region?: string;
      language?: string;
      regulation?: string;
      collectionMethod: string;
      checksum: string;
      savedAt: string;
      expiresAt?: string | null;
      vendors?: Record<string, boolean>;
      authenticatedUserId?: string | null;
      policySnapshot?: Record<string, unknown>;
    },
    @Req() req: Request,
  ) {
    const domain = await this.repos.domains.findByDomainKey(body.domainKey);
    if (!domain || !domain.enabled) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } };
    }

    if (requiresVerification(domain)) {
      return {
        ok: false,
        error: { code: 'DOMAIN_NOT_VERIFIED', message: 'Domain is not verified' },
      };
    }

    const expectedChecksum = createHash('sha256')
      .update(
        JSON.stringify({
          visitorId: body.visitorId,
          configVersion: body.configVersion,
          categories: body.categories,
          savedAt: body.savedAt,
        }),
      )
      .digest('hex')
      .slice(0, 32);

    if (body.checksum !== expectedChecksum) {
      return { ok: false, error: { code: 'INVALID_CHECKSUM', message: 'Consent checksum mismatch' } };
    }

    const previous = await this.repos.consentSubmissions.findLatestForVisitor(domain.id, body.visitorId);
    const publishedConfig = await this.consentService.getPublishedConfig(domain.id);
    const organization = await this.repos.organizations.findById(domain.organizationId);

    const payload = buildConsentRecordPayload({
      domain: {
        id: domain.id,
        organizationId: domain.organizationId,
        domainKey: domain.domainKey,
        region: domain.region,
        verificationToken: domain.verificationToken,
      },
      organization: organization
        ? {
            defaultRegulation: organization.defaultRegulation,
            storeConsentIpAddress: organization.storeConsentIpAddress,
          }
        : null,
      visitorId: body.visitorId,
      authenticatedUserId: body.authenticatedUserId ?? null,
      policyVersionId: body.policyVersionId ?? publishedConfig?.policyVersionId ?? null,
      configVersion: body.configVersion,
      categories: body.categories,
      vendors: body.vendors ?? null,
      policySnapshot: body.policySnapshot ?? null,
      region: body.region ?? domain.region,
      language: body.language ?? null,
      regulation: body.regulation ?? null,
      collectionMethod: body.collectionMethod,
      checksum: body.checksum,
      savedAt: body.savedAt,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      previousRecord: previous
        ? { id: previous.id, expiresAt: previous.expiresAt }
        : null,
      publishedConfig: publishedConfig
        ? {
            policyVersionId: publishedConfig.policyVersionId,
            requiresRenewal: publishedConfig.requiresRenewal,
            categories: publishedConfig.categories as Array<{ slug: string; required?: boolean }>,
          }
        : null,
      req,
    });

    const record = await this.repos.consentSubmissions.create({
      id: payload.id,
      domainId: payload.domainId,
      organizationId: payload.organizationId,
      visitorId: payload.visitorId,
      authenticatedUserId: payload.authenticatedUserId,
      policyVersionId: payload.policyVersionId,
      configVersion: payload.configVersion,
      bannerVersion: payload.bannerVersion,
      categories: payload.categories,
      vendors: payload.vendors,
      region: payload.region,
      language: payload.language,
      regulation: payload.regulation,
      collectionMethod: payload.collectionMethod,
      eventType: payload.eventType,
      consentStatus: payload.consentStatus,
      checksum: payload.checksum,
      proofHash: payload.proofHash,
      policySnapshotHash: payload.policySnapshotHash,
      policySnapshot: payload.policySnapshot,
      previousRecordId: payload.previousRecordId,
      userAgent: payload.userAgent,
      ipAddressHash: payload.ipAddressHash,
      expiresAt: payload.expiresAt,
      withdrawnAt: payload.withdrawnAt,
      groupVisitorId: await this.enterpriseService.computeGroupVisitorIdForDomain(
        domain.id,
        body.visitorId,
      ),
    });

    const savedAt = record.createdAt.toISOString();
    const consentToken = signConsentToken(domain.verificationToken, {
      consentId: record.id,
      visitorId: record.visitorId,
      domainKey: domain.domainKey,
      configVersion: body.configVersion,
      savedAt,
    });
    const verificationToken = createVisitorVerificationToken(
      domain.verificationToken,
      record.visitorId,
      domain.domainKey,
    );

    void this.webhookDelivery.emit(
      domain.organizationId,
      mapConsentWebhookEvent(body.collectionMethod, Boolean(previous)),
      {
        consentId: record.id,
        domainId: domain.id,
        domainKey: domain.domainKey,
        visitorId: record.visitorId,
        eventType: record.eventType,
        collectionMethod: body.collectionMethod,
        consentStatus: record.consentStatus,
        categories: body.categories,
        savedAt: record.createdAt.toISOString(),
      },
    );

    return ok({
      consentId: record.id,
      visitorId: record.visitorId,
      savedAt: record.createdAt.toISOString(),
      proofHash: record.proofHash,
      consentToken,
      verificationToken,
    });
  }

  @Public()
  @Get('consent/verify/:domainKey')
  async verifyConsentToken(
    @Param('domainKey') domainKey: string,
    @Req() req: Request,
  ) {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      return { ok: false, error: { code: 'INVALID_TOKEN', message: 'Missing consent token' } };
    }

    const domain = await this.repos.domains.findByDomainKey(domainKey);
    if (!domain || !domain.enabled) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } };
    }

    const payload = verifyConsentToken(domain.verificationToken, token);
    if (!payload || payload.domainKey !== domain.domainKey) {
      return { ok: false, error: { code: 'INVALID_TOKEN', message: 'Consent token is invalid' } };
    }

    const record = await this.repos.consentSubmissions.findLatestForVisitor(domain.id, payload.visitorId);
    if (!record || record.id !== payload.consentId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Consent record not found' } };
    }

    return ok({
      valid: true,
      consentId: record.id,
      visitorId: record.visitorId,
      configVersion: record.configVersion,
      savedAt: record.createdAt.toISOString(),
    });
  }

  @Public()
  @Get('consent/:domainKey/:visitorId')
  async getConsentForVisitor(
    @Param('domainKey') domainKey: string,
    @Param('visitorId') visitorId: string,
  ): Promise<unknown> {
    const domain = await this.repos.domains.findByDomainKey(domainKey);
    if (!domain || !domain.enabled) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } };
    }

    const record = await this.repos.consentSubmissions.findLatestForVisitor(domain.id, visitorId);
    if (!record) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'No consent record found' } };
    }

    return ok({
      consentId: record.id,
      visitorId: record.visitorId,
      categories: record.categories,
      policyVersionId: record.policyVersionId,
      configVersion: record.configVersion,
      region: record.region,
      language: record.language,
      consentStatus: record.consentStatus,
      proofHash: record.proofHash,
      savedAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt?.toISOString() ?? null,
      withdrawn: record.consentStatus === 'WITHDRAWN' || Boolean(record.withdrawnAt),
      verificationToken: createVisitorVerificationToken(
        domain.verificationToken,
        record.visitorId,
        domain.domainKey,
      ),
    });
  }

  @Public()
  @Post('heartbeat')
  async heartbeat(
    @Body(new ZodValidationPipe(sdkHeartbeatSchema))
    body: {
      domainKey: string;
      hostname: string;
      scriptLoaded?: boolean;
      consentEventDetected?: boolean;
      autoBlockingEnabled?: boolean;
      googleConsentModeDetected?: boolean;
      googleConsentModeEnabled?: boolean;
      googleConsentModeDefaultApplied?: boolean;
      googleConsentModeUpdateApplied?: boolean;
      googleConsentModeMode?: 'basic' | 'advanced';
      duplicateScripts?: number;
      jsErrors?: string[];
      scriptLoadedFirst?: boolean;
      defaultConsentApplied?: boolean;
      preConsentViolations?: number;
      integrationSource?: string;
    },
  ) {
    const domain = await this.repos.domains.findByDomainKey(body.domainKey);
    if (!domain) {
      return { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid domain key' } };
    }

    const existing = (domain.sdkLastHeartbeat as Record<string, unknown> | null) ?? {};
    await this.repos.domains.recordSdkHeartbeat(body.domainKey, {
      ...existing,
      scriptLoaded: body.scriptLoaded,
      consentEventDetected: body.consentEventDetected,
      autoBlockingEnabled: body.autoBlockingEnabled,
      googleConsentModeDetected: body.googleConsentModeDetected,
      googleConsentModeEnabled: body.googleConsentModeEnabled,
      googleConsentModeDefaultApplied: body.googleConsentModeDefaultApplied,
      googleConsentModeUpdateApplied: body.googleConsentModeUpdateApplied,
      googleConsentModeMode: body.googleConsentModeMode,
      duplicateScripts: body.duplicateScripts,
      jsErrors: body.jsErrors,
      scriptLoadedFirst: body.scriptLoadedFirst,
      defaultConsentApplied: body.defaultConsentApplied,
      preConsentViolations:
        body.preConsentViolations ??
        (typeof existing.preConsentViolations === 'number' ? existing.preConsentViolations : undefined),
      integrationSource:
        body.integrationSource ??
        (typeof existing.integrationSource === 'string' ? existing.integrationSource : undefined),
    });

    if (
      DOMAIN_CONFIG.autoVerifyOnHeartbeat &&
      domain.verificationStatus !== 'VERIFIED' &&
      body.scriptLoaded !== false
    ) {
      await this.repos.domains.markVerified(domain.id, 'CMP_SCRIPT');
    }

    const refreshed = await this.repos.domains.findByDomainKey(body.domainKey);

    return ok({
      received: true,
      domainKey: body.domainKey,
      configVersion: refreshed?.configVersion ?? domain.configVersion,
      verified: refreshed?.verificationStatus === 'VERIFIED',
    });
  }

  @Public()
  @Post('violations')
  async reportViolations(
    @Body(new ZodValidationPipe(blockingViolationReportSchema))
    body: {
      domainKey: string;
      violations: Array<{
        url: string;
        resourceType: string;
        category?: string;
        vendor?: string;
        rulePattern?: string;
        pageUrl?: string;
      }>;
    },
  ) {
    const result = await this.blockingService.recordViolations(body.domainKey, body.violations);
    return ok(result);
  }

  @Public()
  @Get('sdk.js')
  @Header('Content-Type', 'application/javascript')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  sdkScript(@Res() res: Response) {
    res.send(loadSdkBundle());
  }
}
