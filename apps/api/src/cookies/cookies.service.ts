import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Repositories } from '@cmp/database';
import type { CurrentUser } from '@cmp/types';
import type { UpdateDomainCookieInput } from '@cmp/validation';
import { REPOS } from '../database/database.module';
import { assertSameOrganization } from '../common/guards/tenant.guard';
import { AuditService } from '../audit/audit.service';
import type { AuditMeta } from '../organizations/organizations.service';
import { matchCookieDefinition, reviewStatusForMatch } from './cookie-matcher';
import {
  buildCookieKey,
  compareScanCookies,
  type ScanCookieRecord,
} from './scan-comparison';
import {
  groupScanFindingsForIngest,
  isStorageFindingType,
  isTrackerFindingType,
  resolveProviderDomain,
  resolveStorageCategory,
  resolveTrackerCategory,
  shouldIncludeInInventory,
} from './scan-findings-ingest';
import type { ScanFindingType } from '@cmp/database';
import { getHostname } from '../scans/scanner/crawl.util';

@Injectable()
export class CookiesService {
  constructor(
    @Inject(REPOS) private readonly repos: Repositories,
    private readonly auditService: AuditService,
  ) {}

  async listDefinitions(user: CurrentUser) {
    this.requireOrg(user);
    const definitions = await this.repos.cookies.listDefinitions(user.organizationId);
    return definitions.map((item) => this.toDefinitionResponse(item));
  }

  async listDomainCookies(user: CurrentUser, domainId: string) {
    const domain = await this.getDomainForUser(user, domainId);
    const cookies = await this.repos.cookies.listByDomain(domain.id);
    return cookies.map((item) => this.toDomainCookieResponse(item));
  }

  async listUnknown(user: CurrentUser, domainId: string) {
    const domain = await this.getDomainForUser(user, domainId);
    const cookies = await this.repos.cookies.listUnknownByDomain(domain.id);
    return cookies.map((item) => this.toDomainCookieResponse(item));
  }

  async getCategorySummary(user: CurrentUser, domainId: string) {
    const domain = await this.getDomainForUser(user, domainId);

    let categories = await this.repos.consentCategories.listByDomain(domain.id);
    if (categories.length === 0) {
      categories = await this.repos.consentCategories.seedDefaults(domain.id, domain.organizationId);
    }

    const counts = await this.repos.cookies.countByCategory(domain.id);
    const countBySlug = new Map<string, number>();
    let unclassified = 0;
    for (const { category, count } of counts) {
      const slug = category?.trim().toLowerCase();
      const matched = slug && categories.some((c) => c.slug === slug);
      if (matched) {
        countBySlug.set(slug!, (countBySlug.get(slug!) ?? 0) + count);
      } else {
        unclassified += count;
      }
    }

    const summary = categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      count: (countBySlug.get(c.slug) ?? 0) + (c.slug === 'unclassified' ? unclassified : 0),
    }));

    const allItems = await this.repos.cookies.listByDomain(domain.id);
    const cookies = allItems.filter((item) => {
      const type =
        typeof item.metadata === 'object' &&
        item.metadata !== null &&
        'findingType' in item.metadata
          ? String((item.metadata as Record<string, unknown>).findingType)
          : 'COOKIE';
      return type === 'COOKIE' || isStorageFindingType(type as ScanFindingType);
    }).length;
    const trackers = allItems.filter((item) => {
      const type =
        typeof item.metadata === 'object' &&
        item.metadata !== null &&
        'findingType' in item.metadata
          ? String((item.metadata as Record<string, unknown>).findingType)
          : 'COOKIE';
      return isTrackerFindingType(type as ScanFindingType);
    }).length;

    return {
      total: allItems.length,
      cookies,
      trackers,
      categories: summary,
    };
  }

  async reviewCookie(
    user: CurrentUser,
    domainId: string,
    cookieId: string,
    input: UpdateDomainCookieInput,
    meta: AuditMeta,
  ) {
    const domain = await this.getDomainForUser(user, domainId);
    const cookie = await this.repos.cookies.findDomainCookieById(cookieId);
    if (!cookie || cookie.domainId !== domain.id) {
      throw new NotFoundException({ code: 'COOKIE_NOT_FOUND', message: 'Cookie not found' });
    }

    const updated = await this.repos.cookies.updateDomainCookie(cookieId, {
      provider: input.provider,
      providerDomain: input.providerDomain,
      description: input.description,
      purpose: input.purpose,
      category: input.category,
      duration: input.duration,
      dataCollected: input.dataCollected,
      isThirdParty: input.isThirdParty,
      privacyPolicyUrl: input.privacyPolicyUrl,
      riskLevel: input.riskLevel,
      reviewStatus: input.reviewStatus ?? 'APPROVED',
      matchMethod: 'MANUAL',
      matchConfidence: 100,
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
    });

    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'cookie.reviewed',
      module: 'cookie',
      previousValue: { id: cookie.id, reviewStatus: cookie.reviewStatus },
      newValue: { id: updated.id, reviewStatus: updated.reviewStatus, category: updated.category },
      ...meta,
    });

    return this.toDomainCookieResponse(updated);
  }

  async compareScans(
    user: CurrentUser,
    domainId: string,
    baselineScanId: string,
    targetScanId: string,
  ) {
    const domain = await this.getDomainForUser(user, domainId);
    const baseline = await this.repos.scans.findById(baselineScanId);
    const target = await this.repos.scans.findById(targetScanId);

    if (!baseline || baseline.domainId !== domain.id) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Baseline scan not found' });
    }
    if (!target || target.domainId !== domain.id) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Target scan not found' });
    }

    const baselineCookies = this.extractScanCookies(baseline.findings);
    const targetCookies = this.extractScanCookies(target.findings);
    const diff = compareScanCookies(baselineCookies, targetCookies);

    return {
      baselineScanId,
      targetScanId,
      baselineCount: baselineCookies.length,
      targetCount: targetCookies.length,
      ...diff,
    };
  }

  async ingestScanResults(scanId: string) {
    const scan = await this.repos.scans.findById(scanId);
    if (!scan) return;

    const siteHostname = getHostname(scan.startUrl) ?? '';
    const inventoryFindings = scan.findings.filter((finding) =>
      shouldIncludeInInventory(finding, siteHostname),
    );
    const grouped = groupScanFindingsForIngest(inventoryFindings);

    if (grouped.length === 0) {
      return;
    }

    const definitions = await this.repos.cookies.listDefinitions(scan.organizationId);

    for (const entry of grouped) {
      const match = matchCookieDefinition(definitions, {
        cookieName: entry.cookieName,
        cookieDomain: entry.cookieDomain,
        sourceUrl: entry.sourceUrl,
        isThirdParty: entry.isThirdParty,
      });

      let category = match?.category;
      let provider = match?.provider;
      let reviewStatus = match ? reviewStatusForMatch(match.confidence) : 'PENDING';

      if (!match && isTrackerFindingType(entry.findingType)) {
        const trackerCategory = resolveTrackerCategory(entry.cookieName, entry.sourceUrl);
        if (trackerCategory) {
          category = trackerCategory;
          provider = entry.cookieName;
          reviewStatus = 'AUTO_MATCHED';
        }
      }

      if (!match && isStorageFindingType(entry.findingType)) {
        const storageCategory = resolveStorageCategory(entry.pageUrl);
        if (storageCategory) {
          category = storageCategory;
          provider = resolveProviderDomain(entry) ?? undefined;
          reviewStatus = 'AUTO_MATCHED';
        }
      }

      const providerDomain = match?.providerDomain ?? resolveProviderDomain(entry);

      await this.repos.cookies.upsertDomainCookie({
        domainId: scan.domainId,
        organizationId: scan.organizationId,
        inventoryKey: entry.inventoryKey,
        cookieName: entry.cookieName,
        cookieDomain: entry.cookieDomain,
        provider,
        providerDomain,
        description: match?.description,
        purpose: match?.purpose,
        category,
        duration: match?.duration,
        dataCollected: match?.dataCollected,
        isThirdParty: match?.isThirdParty ?? entry.isThirdParty,
        privacyPolicyUrl: match?.privacyPolicyUrl,
        riskLevel: match?.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | undefined,
        cookieDefinitionId: match?.definitionId,
        matchMethod: match?.matchMethod,
        matchConfidence: match?.confidence,
        reviewStatus,
        lastScanId: scanId,
        expiresAt: entry.expiresAt,
        foundBeforeConsent: entry.foundBeforeConsent,
        sourceUrl: entry.sourceUrl,
        metadata: {
          ...entry.metadata,
          pageUrl: entry.pageUrl,
          ...(match
            ? { suggestedMatch: { definitionId: match.definitionId, confidence: match.confidence } }
            : {}),
        },
      });
    }

    await this.repos.cookies.deleteByDomainNotFromScan(scan.domainId, scanId);
  }

  private extractScanCookies(
    findings: Array<{
      findingType: string;
      name: string;
      cookieDomain: string | null;
      consentState: string;
      sourceUrl: string | null;
      expiresAt: Date | null;
      isThirdParty: boolean | null;
    }>,
  ): ScanCookieRecord[] {
    const map = new Map<string, ScanCookieRecord>();

    for (const finding of findings) {
      if (finding.findingType !== 'COOKIE') continue;
      const key = buildCookieKey(finding.name, finding.cookieDomain);
      const existing = map.get(key);
      map.set(key, {
        key,
        name: finding.name,
        domain: finding.cookieDomain,
        category: existing?.category ?? null,
        provider: existing?.provider ?? null,
        duration: existing?.duration ?? null,
        isThirdParty: finding.isThirdParty ?? existing?.isThirdParty ?? null,
        foundBeforeConsent:
          finding.consentState === 'BEFORE_CONSENT' || existing?.foundBeforeConsent || false,
        sourceUrl: finding.sourceUrl ?? existing?.sourceUrl ?? null,
        expiresAt: finding.expiresAt?.toISOString() ?? existing?.expiresAt ?? null,
      });
    }

    return Array.from(map.values());
  }

  private requireOrg(user: CurrentUser) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'ORG_REQUIRED', message: 'Organization required' });
    }
  }

  private async getDomainForUser(user: CurrentUser, domainId: string) {
    this.requireOrg(user);
    const domain = await this.repos.domains.findById(domainId);
    if (!domain) {
      throw new NotFoundException({ code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' });
    }
    assertSameOrganization(user, domain.organizationId);
    return domain;
  }

  private toDefinitionResponse(definition: {
    id: string;
    cookieName: string;
    provider: string;
    providerDomain: string | null;
    description: string | null;
    purpose: string | null;
    category: string;
    duration: string | null;
    isThirdParty: boolean;
    riskLevel: string;
  }) {
    return {
      id: definition.id,
      cookieName: definition.cookieName,
      provider: definition.provider,
      providerDomain: definition.providerDomain,
      description: definition.description,
      purpose: definition.purpose,
      category: definition.category,
      duration: definition.duration,
      isThirdParty: definition.isThirdParty,
      riskLevel: definition.riskLevel,
    };
  }

  private toDomainCookieResponse(cookie: {
    id: string;
    cookieName: string;
    cookieDomain: string | null;
    provider: string | null;
    providerDomain: string | null;
    description: string | null;
    purpose: string | null;
    category: string | null;
    duration: string | null;
    isThirdParty: boolean | null;
    privacyPolicyUrl: string | null;
    riskLevel: string | null;
    matchMethod: string | null;
    matchConfidence: number | null;
    reviewStatus: string;
    firstSeenAt: Date;
    lastSeenAt: Date;
    seenCount: number;
    foundBeforeConsent: boolean;
    sourceUrl: string | null;
    expiresAt: Date | null;
    lastScanId: string | null;
    metadata: unknown;
  }) {
    return {
      id: cookie.id,
      cookieName: cookie.cookieName,
      cookieDomain: cookie.cookieDomain,
      provider: cookie.provider,
      providerDomain: cookie.providerDomain,
      description: cookie.description,
      purpose: cookie.purpose,
      category: cookie.category,
      duration: cookie.duration,
      isThirdParty: cookie.isThirdParty,
      privacyPolicyUrl: cookie.privacyPolicyUrl,
      riskLevel: cookie.riskLevel,
      matchMethod: cookie.matchMethod,
      matchConfidence: cookie.matchConfidence,
      reviewStatus: cookie.reviewStatus,
      firstSeenAt: cookie.firstSeenAt.toISOString(),
      lastSeenAt: cookie.lastSeenAt.toISOString(),
      seenCount: cookie.seenCount,
      foundBeforeConsent: cookie.foundBeforeConsent,
      sourceUrl: cookie.sourceUrl,
      expiresAt: cookie.expiresAt?.toISOString() ?? null,
      lastScanId: cookie.lastScanId,
      inventoryType:
        typeof cookie.metadata === 'object' &&
        cookie.metadata !== null &&
        'findingType' in cookie.metadata
          ? String((cookie.metadata as Record<string, unknown>).findingType)
          : 'COOKIE',
      metadata: cookie.metadata as Record<string, unknown> | null,
    };
  }
}
