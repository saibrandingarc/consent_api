const COOKIE_PREFIX = 'cmp_';

export interface StorageOptions {
  cookieDomain?: string | null;
}

let defaultCookieDomain: string | null = null;

export function setDefaultCookieDomain(domain: string | null) {
  defaultCookieDomain = domain;
}

export function getDefaultCookieDomain() {
  return defaultCookieDomain;
}

function resolveCookieDomain(options?: StorageOptions) {
  return options?.cookieDomain ?? defaultCookieDomain ?? null;
}

function encodeCookieValue(value: string) {
  return encodeURIComponent(value);
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function readCookie(name: string, options?: StorageOptions): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_PREFIX}${name}=([^;]*)`));
  return match?.[1] ? decodeCookieValue(match[1]) : null;
}

export function writeCookie(name: string, value: string, maxAgeSeconds: number, options?: StorageOptions) {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  const domain = resolveCookieDomain(options);
  const domainAttr = domain ? `; Domain=${domain}` : '';
  document.cookie = `${COOKIE_PREFIX}${name}=${encodeCookieValue(value)}; Path=/${domainAttr}; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function removeCookie(name: string, options?: StorageOptions) {
  if (typeof document === 'undefined') return;
  const domain = resolveCookieDomain(options);
  const domainAttr = domain ? `; Domain=${domain}` : '';
  document.cookie = `${COOKIE_PREFIX}${name}=; Path=/${domainAttr}; Max-Age=0; SameSite=Lax`;
}

export function readStorage(key: string, options?: StorageOptions): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
    } catch {
      // localStorage may be blocked
    }
  }
  return readCookie(key.replace(/^cmp_/, ''), options);
}

export function writeStorage(key: string, value: string, maxAgeSeconds = 31_536_000, options?: StorageOptions) {
  let persisted = false;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
      persisted = true;
    } catch {
      // fall back to cookie
    }
  }
  writeCookie(key.replace(/^cmp_/, ''), value, maxAgeSeconds, options);
  if (!persisted && typeof localStorage === 'undefined') {
    // cookie-only path already handled
  }
}

export function removeStorage(key: string, options?: StorageOptions) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  removeCookie(key.replace(/^cmp_/, ''), options);
}
