import { createHash } from 'node:crypto';

export type ConsentEventType =
  | 'INITIAL_CONSENT'
  | 'CONSENT_UPDATE'
  | 'CONSENT_WITHDRAWAL'
  | 'CONSENT_RENEWAL'
  | 'POLICY_RENEWAL'
  | 'CONSENT_EXPIRATION'
  | 'ADMIN_INVALIDATION';

export type ConsentStatusValue = 'GRANTED' | 'PARTIAL' | 'REJECTED' | 'WITHDRAWN';

export function hashIpAddress(ip: string | undefined | null, salt: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export function computePolicySnapshotHash(input: {
  policyVersionId?: string | null;
  configVersion: number;
  bannerVersion?: number | null;
}): string {
  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 32);
}

export function computeProofHash(input: {
  consentId: string;
  organizationId: string;
  domainId: string;
  visitorId: string;
  categories: Record<string, boolean>;
  policyVersionId?: string | null;
  configVersion: number;
  collectionMethod: string;
  checksum: string;
  createdAt: string;
  policySnapshotHash?: string | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        consentId: input.consentId,
        organizationId: input.organizationId,
        domainId: input.domainId,
        visitorId: input.visitorId,
        categories: input.categories,
        policyVersionId: input.policyVersionId ?? null,
        configVersion: input.configVersion,
        collectionMethod: input.collectionMethod,
        checksum: input.checksum,
        createdAt: input.createdAt,
        policySnapshotHash: input.policySnapshotHash ?? null,
      }),
    )
    .digest('hex');
}

export function mapEventType(
  collectionMethod: string,
  hasPrevious: boolean,
  options?: { requiresRenewal?: boolean; previousExpired?: boolean },
): ConsentEventType {
  if (collectionMethod === 'withdrawal') return 'CONSENT_WITHDRAWAL';
  if (options?.requiresRenewal) return 'CONSENT_RENEWAL';
  if (options?.previousExpired) return 'CONSENT_EXPIRATION';
  if (!hasPrevious) return 'INITIAL_CONSENT';
  return 'CONSENT_UPDATE';
}

export function deriveConsentStatus(
  categories: Record<string, boolean>,
  categorySnapshots: Array<{ slug: string; required?: boolean }>,
  collectionMethod: string,
): ConsentStatusValue {
  if (collectionMethod === 'withdrawal') return 'WITHDRAWN';

  const optional = categorySnapshots.filter(
    (category) => category.slug !== 'strictly_necessary' && !category.required,
  );
  if (optional.length === 0) return 'GRANTED';

  const enabledCount = optional.filter((category) => categories[category.slug]).length;
  if (enabledCount === 0) return 'REJECTED';
  if (enabledCount === optional.length) return 'GRANTED';
  return 'PARTIAL';
}

export function collectionMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    banner_accept_all: 'Banner — Accept all',
    banner_reject_all: 'Banner — Reject all',
    banner_custom: 'Banner — Custom preferences',
    api: 'JavaScript API',
    withdrawal: 'Consent withdrawal',
  gpc: 'Global Privacy Control',
  consent_expired: 'Consent expired — renewed',
};
  return labels[method] ?? method;
}
