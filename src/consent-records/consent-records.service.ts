import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Repositories } from '@cmp/database';
import type { CurrentUser } from '@cmp/types';
import { REPOS } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { ConsentService } from '../consent/consent.service';
import { assertSameOrganization } from '../common/guards/tenant.guard';
import { buildConsentRecordPayload } from './consent-record.factory';
import { collectionMethodLabel } from './consent-proof.util';
import type { AuditMeta } from '../organizations/organizations.service';
import { createHash } from 'node:crypto';

type ConsentRecordWithDomain = {
  id: string;
  domainId: string;
  organizationId: string;
  visitorId: string;
  authenticatedUserId: string | null;
  policyVersionId: string | null;
  configVersion: number;
  bannerVersion: number | null;
  categories: unknown;
  vendors: unknown;
  region: string | null;
  language: string | null;
  regulation: string | null;
  collectionMethod: string;
  eventType: string;
  consentStatus: string;
  checksum: string;
  proofHash: string;
  policySnapshotHash: string | null;
  policySnapshot: unknown;
  userAgent: string | null;
  ipAddressHash: string | null;
  expiresAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  domain: { hostname: string; domainKey: string };
};

export interface ConsentRecordListItem {
  id: string;
  domainId: string;
  domainHostname: string;
  visitorId: string;
  consentStatus: string;
  eventType: string;
  collectionMethod: string;
  collectionSource: string;
  region: string | null;
  language: string | null;
  regulation: string | null;
  policyVersionId: string | null;
  configVersion: number;
  bannerVersion: number | null;
  categories: Record<string, boolean>;
  proofHash: string;
  createdAt: string;
  expiresAt: string | null;
  withdrawnAt: string | null;
}

export interface ConsentProofView {
  consentId: string;
  organizationId: string;
  domainId: string;
  domainHostname: string;
  domainKey: string;
  visitorId: string;
  authenticatedUserId: string | null;
  consentStatus: string;
  eventType: string;
  collectionMethod: string;
  collectionSource: string;
  categories: Record<string, boolean>;
  vendors: Record<string, boolean> | null;
  policyVersionId: string | null;
  configVersion: number;
  bannerVersion: number | null;
  region: string | null;
  language: string | null;
  regulation: string | null;
  proofHash: string;
  policySnapshotHash: string | null;
  policySnapshot: Record<string, unknown> | null;
  checksum: string;
  userAgent: string | null;
  ipAddressStored: boolean;
  createdAt: string;
  expiresAt: string | null;
  withdrawnAt: string | null;
  history: ConsentRecordListItem[];
  isLatest: boolean;
}

@Injectable()
export class ConsentRecordsService {
  constructor(
    @Inject(REPOS) private readonly repos: Repositories,
    private readonly consentService: ConsentService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    user: CurrentUser,
    query: {
      domainId?: string;
      consentId?: string;
      visitorId?: string;
      from?: string;
      to?: string;
      consentStatus?: string;
      collectionMethod?: string;
      region?: string;
      regulation?: string;
      policyVersionId?: string;
      limit: number;
      cursor?: string;
    },
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }

    if (query.domainId) {
      await this.assertDomainAccess(user, query.domainId);
    }

    const records = await this.repos.consentSubmissions.search({
      organizationId: user.organizationId,
      domainId: query.domainId,
      consentId: query.consentId,
      visitorId: query.visitorId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      consentStatus: query.consentStatus,
      collectionMethod: query.collectionMethod,
      region: query.region,
      regulation: query.regulation,
      policyVersionId: query.policyVersionId,
      limit: query.limit,
      cursor: query.cursor,
    });

    const hasMore = records.length > query.limit;
    const items = hasMore ? records.slice(0, query.limit) : records;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return {
      items: items.map((record) => this.toListItem(record as ConsentRecordWithDomain)),
      nextCursor,
    };
  }

  async getProof(user: CurrentUser, consentId: string): Promise<ConsentProofView> {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }

    const record = await this.repos.consentSubmissions.findById(consentId);
    if (!record) {
      throw new NotFoundException({ code: 'CONSENT_NOT_FOUND', message: 'Consent record not found' });
    }
    assertSameOrganization(user, record.organizationId);

    const history = await this.repos.consentSubmissions.findHistoryForVisitor(
      record.domainId,
      record.visitorId,
    );
    const latest = history[history.length - 1];
    const domainInfo = (record as ConsentRecordWithDomain).domain;

    return this.toProofView(
      record as ConsentRecordWithDomain,
      history.map((item) => ({ ...item, domain: domainInfo })) as ConsentRecordWithDomain[],
      latest?.id === record.id,
    );
  }

  async exportRecords(
    user: CurrentUser,
    query: {
      domainId?: string;
      consentId?: string;
      visitorId?: string;
      from?: string;
      to?: string;
      consentStatus?: string;
      collectionMethod?: string;
      region?: string;
      regulation?: string;
      policyVersionId?: string;
    },
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }

    if (query.domainId) {
      await this.assertDomainAccess(user, query.domainId);
    }

    const records = await this.repos.consentSubmissions.exportAll({
      organizationId: user.organizationId,
      domainId: query.domainId,
      consentId: query.consentId,
      visitorId: query.visitorId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      consentStatus: query.consentStatus,
      collectionMethod: query.collectionMethod,
      region: query.region,
      regulation: query.regulation,
      policyVersionId: query.policyVersionId,
    });

    return records.map((record) => this.toListItem(record as ConsentRecordWithDomain));
  }

  async invalidateVisitorConsent(
    user: CurrentUser,
    input: { domainId: string; visitorId: string; reason?: string },
    meta: AuditMeta,
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }

    const domain = await this.assertDomainAccess(user, input.domainId);
    const organization = await this.repos.organizations.findById(domain.organizationId);
    const categories = await this.repos.consentCategories.listByDomain(input.domainId);
    const rejectCategories: Record<string, boolean> = {};
    for (const category of categories) {
      rejectCategories[category.slug] =
        category.slug === 'strictly_necessary' || category.required;
    }

    const previous = await this.repos.consentSubmissions.findLatestForVisitor(
      domain.id,
      input.visitorId,
    );
    const publishedConfig = await this.consentService.getPublishedConfig(domain.id);
    const savedAt = new Date().toISOString();
    const checksum = createHash('sha256')
      .update(JSON.stringify({ visitorId: input.visitorId, adminInvalidation: true, savedAt }))
      .digest('hex')
      .slice(0, 32);

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
      visitorId: input.visitorId,
      configVersion: domain.configVersion,
      categories: rejectCategories,
      collectionMethod: 'api',
      checksum,
      savedAt,
      previousRecord: previous ? { id: previous.id, expiresAt: previous.expiresAt } : null,
      publishedConfig: publishedConfig
        ? {
            policyVersionId: publishedConfig.policyVersionId,
            requiresRenewal: publishedConfig.requiresRenewal,
            categories: publishedConfig.categories as Array<{ slug: string; required?: boolean }>,
          }
        : null,
      eventTypeOverride: 'ADMIN_INVALIDATION',
    });

    const record = await this.repos.consentSubmissions.create({
      id: payload.id,
      domainId: payload.domainId,
      organizationId: payload.organizationId,
      visitorId: payload.visitorId,
      policyVersionId: payload.policyVersionId,
      configVersion: payload.configVersion,
      bannerVersion: payload.bannerVersion,
      categories: payload.categories,
      region: payload.region,
      language: payload.language,
      regulation: payload.regulation,
      collectionMethod: payload.collectionMethod,
      eventType: payload.eventType,
      consentStatus: payload.consentStatus,
      checksum: payload.checksum,
      proofHash: payload.proofHash,
      policySnapshotHash: payload.policySnapshotHash,
      policySnapshot: {
        invalidatedBy: user.id,
        reason: input.reason ?? 'Administrator invalidation',
        invalidatedAt: savedAt,
      },
      previousRecordId: payload.previousRecordId,
      ipAddressHash: payload.ipAddressHash,
      withdrawnAt: payload.withdrawnAt,
    });

    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'consent.admin_invalidated',
      module: 'consent',
      newValue: {
        domainId: input.domainId,
        visitorId: input.visitorId,
        consentId: record.id,
        reason: input.reason,
      },
      ...meta,
    });

    return this.toListItem({
      ...record,
      domain: { hostname: domain.hostname, domainKey: domain.domainKey },
    } as ConsentRecordWithDomain);
  }

  private async assertDomainAccess(user: CurrentUser, domainId: string) {
    const domain = await this.repos.domains.findById(domainId);
    if (!domain) {
      throw new NotFoundException({ code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' });
    }
    assertSameOrganization(user, domain.organizationId);
    return domain;
  }

  private toListItem(record: ConsentRecordWithDomain): ConsentRecordListItem {
    return {
      id: record.id,
      domainId: record.domainId,
      domainHostname: record.domain.hostname,
      visitorId: record.visitorId,
      consentStatus: record.consentStatus,
      eventType: record.eventType,
      collectionMethod: record.collectionMethod,
      collectionSource: collectionMethodLabel(record.collectionMethod),
      region: record.region,
      language: record.language,
      regulation: record.regulation,
      policyVersionId: record.policyVersionId,
      configVersion: record.configVersion,
      bannerVersion: record.bannerVersion,
      categories: record.categories as Record<string, boolean>,
      proofHash: record.proofHash,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt?.toISOString() ?? null,
      withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
    };
  }

  private toProofView(
    record: ConsentRecordWithDomain,
    history: ConsentRecordWithDomain[],
    isLatest: boolean,
  ): ConsentProofView {
    const historyWithDomain = history;

    return {
      consentId: record.id,
      organizationId: record.organizationId,
      domainId: record.domainId,
      domainHostname: record.domain.hostname,
      domainKey: record.domain.domainKey,
      visitorId: record.visitorId,
      authenticatedUserId: record.authenticatedUserId,
      consentStatus: record.consentStatus,
      eventType: record.eventType,
      collectionMethod: record.collectionMethod,
      collectionSource: collectionMethodLabel(record.collectionMethod),
      categories: record.categories as Record<string, boolean>,
      vendors: (record.vendors as Record<string, boolean> | null) ?? null,
      policyVersionId: record.policyVersionId,
      configVersion: record.configVersion,
      bannerVersion: record.bannerVersion,
      region: record.region,
      language: record.language,
      regulation: record.regulation,
      proofHash: record.proofHash,
      policySnapshotHash: record.policySnapshotHash,
      policySnapshot: (record.policySnapshot as Record<string, unknown> | null) ?? null,
      checksum: record.checksum,
      userAgent: record.userAgent,
      ipAddressStored: Boolean(record.ipAddressHash),
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt?.toISOString() ?? null,
      withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
      history: historyWithDomain.map((item) => this.toListItem(item as ConsentRecordWithDomain)),
      isLatest,
    };
  }
}
