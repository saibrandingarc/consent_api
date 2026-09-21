export interface ScanCookieRecord {
  key: string;
  name: string;
  domain: string | null;
  category: string | null;
  provider: string | null;
  duration: string | null;
  isThirdParty: boolean | null;
  foundBeforeConsent: boolean;
  sourceUrl: string | null;
  expiresAt: string | null;
}

export interface ScanCookieDiff {
  newCookies: ScanCookieRecord[];
  removedCookies: ScanCookieRecord[];
  changedCookies: Array<{
    key: string;
    before: ScanCookieRecord;
    after: ScanCookieRecord;
    changes: string[];
  }>;
}

export function buildCookieKey(name: string, domain: string | null) {
  return `${name}|${domain ?? ''}`;
}

export function compareScanCookies(
  baseline: ScanCookieRecord[],
  target: ScanCookieRecord[],
): ScanCookieDiff {
  const baselineMap = new Map(baseline.map((item) => [item.key, item]));
  const targetMap = new Map(target.map((item) => [item.key, item]));

  const newCookies: ScanCookieRecord[] = [];
  const removedCookies: ScanCookieRecord[] = [];
  const changedCookies: ScanCookieDiff['changedCookies'] = [];

  for (const [key, after] of targetMap.entries()) {
    const before = baselineMap.get(key);
    if (!before) {
      newCookies.push(after);
      continue;
    }

    const changes: string[] = [];
    if (before.category !== after.category) changes.push('category');
    if (before.provider !== after.provider) changes.push('provider');
    if (before.duration !== after.duration) changes.push('duration');
    if (before.isThirdParty !== after.isThirdParty) changes.push('third_party');
    if (before.sourceUrl !== after.sourceUrl) changes.push('source');
    if (before.foundBeforeConsent !== after.foundBeforeConsent) changes.push('consent_timing');

    if (changes.length > 0) {
      changedCookies.push({ key, before, after, changes });
    }
  }

  for (const [key, before] of baselineMap.entries()) {
    if (!targetMap.has(key)) removedCookies.push(before);
  }

  return { newCookies, removedCookies, changedCookies };
}
