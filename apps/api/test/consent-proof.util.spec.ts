import { describe, expect, it } from 'vitest';
import {
  computeProofHash,
  deriveConsentStatus,
  mapEventType,
} from '../src/consent-records/consent-proof.util';

describe('consent-proof.util', () => {
  it('maps event types from collection method', () => {
    expect(mapEventType('banner_accept_all', false)).toBe('INITIAL_CONSENT');
    expect(mapEventType('banner_custom', true)).toBe('CONSENT_UPDATE');
    expect(mapEventType('withdrawal', true)).toBe('CONSENT_WITHDRAWAL');
    expect(mapEventType('banner_accept_all', true, { requiresRenewal: true })).toBe('CONSENT_RENEWAL');
    expect(mapEventType('banner_custom', true, { previousExpired: true })).toBe('CONSENT_EXPIRATION');
  });

  it('derives consent status', () => {
    const categories = [
      { slug: 'strictly_necessary', required: true },
      { slug: 'analytics', required: false },
      { slug: 'marketing', required: false },
    ];
    expect(
      deriveConsentStatus(
        { strictly_necessary: true, analytics: true, marketing: true },
        categories,
        'banner_accept_all',
      ),
    ).toBe('GRANTED');
    expect(
      deriveConsentStatus(
        { strictly_necessary: true, analytics: false, marketing: false },
        categories,
        'banner_reject_all',
      ),
    ).toBe('REJECTED');
    expect(
      deriveConsentStatus(
        { strictly_necessary: true, analytics: true, marketing: false },
        categories,
        'banner_custom',
      ),
    ).toBe('PARTIAL');
    expect(
      deriveConsentStatus(
        { strictly_necessary: true, analytics: false, marketing: false },
        categories,
        'withdrawal',
      ),
    ).toBe('WITHDRAWN');
  });

  it('produces stable proof hashes', () => {
    const hash = computeProofHash({
      consentId: 'abc-123',
      organizationId: 'org-1',
      domainId: 'domain-1',
      visitorId: 'v_test',
      categories: { strictly_necessary: true, analytics: false },
      policyVersionId: 'policy-1',
      configVersion: 2,
      collectionMethod: 'banner_accept_all',
      checksum: 'checksum123',
      createdAt: '2026-08-03T00:00:00.000Z',
      policySnapshotHash: 'snap1',
    });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});
