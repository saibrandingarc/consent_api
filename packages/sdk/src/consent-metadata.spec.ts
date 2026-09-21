import { describe, expect, it, vi } from 'vitest';
import { CmpSdk } from './cmp-sdk';
import { saveConsent } from './consent-store';

describe('getConsentMetadata', () => {
  it('returns metadata from stored consent', async () => {
    const sdk = new CmpSdk('dk_meta', 'https://api.example.com/public/cmp');
    const savedAt = Date.now();
    const expiresAt = savedAt + 86_400_000;

    saveConsent(
      'dk_meta',
      {
        configVersion: 3,
        categories: { strictly_necessary: true },
        policyVersionId: 'pv_1',
        policyVersionNumber: 2,
        region: 'EU',
        language: 'de',
        expiresAt,
        savedAt,
      },
      { rememberChoice: true, consentExpirationDays: 365 },
    );

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          domainKey: 'dk_meta',
          configVersion: 3,
          policyVersionId: 'pv_1',
          policyVersionNumber: 2,
          region: 'EU',
          categories: [],
          banner: null,
        },
      }),
    } as Response);

    await sdk.init();

    const metadata = sdk.getConsentMetadata();
    expect(metadata).toMatchObject({
      policyVersionId: 'pv_1',
      policyVersionNumber: 2,
      region: 'EU',
      language: 'de',
    });
    expect(metadata?.savedAt).toBeTruthy();
    expect(metadata?.expiresAt).toBeTruthy();

    fetchMock.mockRestore();
  });
});
