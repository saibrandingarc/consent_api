import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import {
  computePolicySnapshotHash,
  computeProofHash,
  deriveConsentStatus,
  hashIpAddress,
  mapEventType,
  type ConsentEventType,
} from './consent-proof.util';

export interface CreateConsentRecordInput {
  domain: {
    id: string;
    organizationId: string;
    domainKey: string;
    region: string | null;
    verificationToken: string;
  };
  organization: {
    defaultRegulation: string | null;
    storeConsentIpAddress: boolean;
  } | null;
  visitorId: string;
  authenticatedUserId?: string | null;
  policyVersionId?: string | null;
  configVersion: number;
  categories: Record<string, boolean>;
  vendors?: Record<string, boolean> | null;
  policySnapshot?: unknown;
  region?: string | null;
  language?: string | null;
  regulation?: string | null;
  collectionMethod: string;
  checksum: string;
  savedAt: string;
  expiresAt?: Date | null;
  previousRecord?: {
    id: string;
    expiresAt: Date | null;
  } | null;
  publishedConfig?: {
    policyVersionId: string;
    requiresRenewal?: boolean;
    categories?: Array<{ slug: string; required?: boolean }>;
  } | null;
  eventTypeOverride?: ConsentEventType;
  req?: Request;
}

export function buildConsentRecordPayload(input: CreateConsentRecordInput) {
  const categorySnapshots =
    input.publishedConfig?.categories ??
    (input.policySnapshot as { categories?: Array<{ slug: string; required?: boolean }> })
      ?.categories ??
    [];

  const policyVersionId =
    input.policyVersionId ?? input.publishedConfig?.policyVersionId ?? null;

  const policySnapshotHash = computePolicySnapshotHash({
    policyVersionId,
    configVersion: input.configVersion,
    bannerVersion: input.configVersion,
  });

  const previousExpired =
    Boolean(input.previousRecord?.expiresAt) &&
    input.previousRecord!.expiresAt! < new Date();

  const eventType =
    input.eventTypeOverride ??
    mapEventType(input.collectionMethod, Boolean(input.previousRecord), {
      requiresRenewal: input.publishedConfig?.requiresRenewal,
      previousExpired,
    });

  const consentStatus = deriveConsentStatus(
    input.categories,
    categorySnapshots,
    input.collectionMethod,
  );

  const consentId = randomUUID();
  const createdAt = new Date();
  const withdrawnAt = input.collectionMethod === 'withdrawal' ? createdAt : null;

  const storeIp = input.organization?.storeConsentIpAddress ?? true;
  const ipAddressHash = storeIp
    ? hashIpAddress(input.req?.ip, input.domain.verificationToken)
    : null;

  const proofHash = computeProofHash({
    consentId,
    organizationId: input.domain.organizationId,
    domainId: input.domain.id,
    visitorId: input.visitorId,
    categories: input.categories,
    policyVersionId,
    configVersion: input.configVersion,
    collectionMethod: input.collectionMethod,
    checksum: input.checksum,
    createdAt: createdAt.toISOString(),
    policySnapshotHash,
  });

  return {
    id: consentId,
    domainId: input.domain.id,
    organizationId: input.domain.organizationId,
    visitorId: input.visitorId,
    authenticatedUserId: input.authenticatedUserId ?? null,
    policyVersionId,
    configVersion: input.configVersion,
    bannerVersion: input.configVersion,
    categories: input.categories,
    vendors: input.vendors ?? null,
    region: input.region ?? input.domain.region,
    language: input.language ?? null,
    regulation:
      input.regulation ??
      input.organization?.defaultRegulation ??
      null,
    collectionMethod: input.collectionMethod,
    eventType,
    consentStatus,
    checksum: input.checksum,
    proofHash,
    policySnapshotHash,
    policySnapshot: input.policySnapshot ?? null,
    previousRecordId: input.previousRecord?.id ?? null,
    userAgent: input.req?.headers['user-agent'] ?? null,
    ipAddressHash,
    expiresAt: input.expiresAt ?? null,
    withdrawnAt,
    createdAt,
  };
}
