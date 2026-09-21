import { readStorage, removeStorage, writeStorage, type StorageOptions } from './storage';

const VISITOR_PREFIX = 'cmp_visitor_';
const VISITOR_TTL_SECONDS = 365 * 24 * 60 * 60;

export interface VisitorIdentity {
  visitorId: string;
  createdAt: number;
  expiresAt: number;
  verificationToken?: string;
}

export interface VisitorOptions {
  domainKey: string;
  sharedCookieDomain?: string | null;
}

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function storageOptions(sharedCookieDomain?: string | null): StorageOptions | undefined {
  return sharedCookieDomain ? { cookieDomain: sharedCookieDomain } : undefined;
}

export function getVisitorStorageKey(options: VisitorOptions) {
  if (options.sharedCookieDomain) {
    return `${VISITOR_PREFIX}shared_${options.sharedCookieDomain.replace(/^\./, '')}`;
  }
  return `${VISITOR_PREFIX}${options.domainKey}`;
}

export function loadVisitorId(options: VisitorOptions): VisitorIdentity | null {
  const storageOpts = storageOptions(options.sharedCookieDomain);
  const raw = readStorage(getVisitorStorageKey(options), storageOpts);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as VisitorIdentity;
    if (!data.visitorId || !data.expiresAt) return null;
    if (Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

export function getOrCreateVisitorId(options: VisitorOptions): VisitorIdentity {
  const existing = loadVisitorId(options);
  if (existing) return existing;

  const identity: VisitorIdentity = {
    visitorId: `v_${randomId()}`,
    createdAt: Date.now(),
    expiresAt: Date.now() + VISITOR_TTL_SECONDS * 1000,
  };
  writeStorage(
    getVisitorStorageKey(options),
    JSON.stringify(identity),
    VISITOR_TTL_SECONDS,
    storageOptions(options.sharedCookieDomain),
  );
  return identity;
}

export function rotateVisitorId(options: VisitorOptions): VisitorIdentity {
  removeStorage(getVisitorStorageKey(options), storageOptions(options.sharedCookieDomain));
  return getOrCreateVisitorId(options);
}

export function saveVisitorVerificationToken(options: VisitorOptions, verificationToken: string) {
  const visitor = getOrCreateVisitorId(options);
  visitor.verificationToken = verificationToken;
  writeStorage(
    getVisitorStorageKey(options),
    JSON.stringify(visitor),
    VISITOR_TTL_SECONDS,
    storageOptions(options.sharedCookieDomain),
  );
  return visitor;
}
