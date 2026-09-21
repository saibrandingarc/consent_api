import { describe, expect, it } from 'vitest';
import {
  buildCookieKey,
  compareScanCookies,
  type ScanCookieRecord,
} from '../src/cookies/scan-comparison';

function record(name: string, domain: string | null, patch?: Partial<ScanCookieRecord>): ScanCookieRecord {
  return {
    key: buildCookieKey(name, domain),
    name,
    domain,
    category: 'analytics',
    provider: 'Google',
    duration: '1 year',
    isThirdParty: true,
    foundBeforeConsent: false,
    sourceUrl: null,
    expiresAt: null,
    ...patch,
  };
}

describe('scan comparison', () => {
  it('detects new, removed, and changed cookies', () => {
    const baseline = [record('_ga', '.example.com')];
    const target = [
      record('_ga', '.example.com', { category: 'marketing' }),
      record('_fbp', '.example.com'),
    ];

    const diff = compareScanCookies(baseline, target);
    expect(diff.newCookies.map((c) => c.name)).toEqual(['_fbp']);
    expect(diff.removedCookies).toHaveLength(0);
    expect(diff.changedCookies[0]?.changes).toContain('category');
  });

  it('detects removed cookies', () => {
    const baseline = [record('_gid', '.example.com')];
    const diff = compareScanCookies(baseline, []);
    expect(diff.removedCookies.map((c) => c.name)).toEqual(['_gid']);
  });
});
