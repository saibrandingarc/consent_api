import { describe, expect, it } from 'vitest';
import { parseConsentToken } from './consent-token';

describe('parseConsentToken', () => {
  it('parses the payload section of a consent token', () => {
    const payload = {
      consentId: 'abc',
      visitorId: 'v_test',
      domainKey: 'dk_test',
      configVersion: 1,
      savedAt: '2026-01-01T00:00:00.000Z',
    };
    const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const parsed = parseConsentToken(`${body}.signature`);
    expect(parsed).toEqual(payload);
  });
});
