import { removeStorage, readStorage, writeStorage } from './storage';
import type { BannerBehavior } from './types';

const STORAGE_PREFIX = 'cmp_consent_';

export interface StoredConsent {
  consentId?: string;
  visitorId?: string;
  configVersion: number;
  policyVersionId?: string | null;
  policyVersionNumber?: number | null;
  categories: Record<string, boolean>;
  region?: string | null;
  language?: string | null;
  expiresAt: number | null;
  savedAt: number;
  checksum?: string;
  consentToken?: string;
  verificationToken?: string;
}

export function getStorageKey(domainKey: string) {
  return `${STORAGE_PREFIX}${domainKey}`;
}

export function loadConsent(domainKey: string, configVersion: number): StoredConsent | null {
  try {
    const raw = readStorage(getStorageKey(domainKey));
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredConsent;
    if (data.configVersion !== configVersion) return null;
    if (data.expiresAt && Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveConsent(
  domainKey: string,
  data: Omit<StoredConsent, 'savedAt'> & { savedAt?: number },
  behavior?: BannerBehavior,
) {
  const days = behavior?.rememberChoice === false ? 0 : (behavior?.consentExpirationDays ?? 365);
  const expiresAt = days > 0 ? Date.now() + days * 86_400_000 : data.expiresAt;
  const maxAgeSeconds = days > 0 ? days * 86_400 : 31_536_000;
  const payload: StoredConsent = {
    ...data,
    expiresAt: expiresAt ?? null,
    savedAt: data.savedAt ?? Date.now(),
  };
  writeStorage(getStorageKey(domainKey), JSON.stringify(payload), maxAgeSeconds);
}

export function clearConsent(domainKey: string) {
  removeStorage(getStorageKey(domainKey));
}

export function wasExpiredConsent(domainKey: string, configVersion: number): boolean {
  try {
    const raw = readStorage(getStorageKey(domainKey));
    if (!raw) return false;
    const data = JSON.parse(raw) as StoredConsent;
    if (data.configVersion !== configVersion) return false;
    return Boolean(data.expiresAt && Date.now() > data.expiresAt);
  } catch {
    return false;
  }
}
