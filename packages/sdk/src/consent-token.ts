export interface ConsentTokenPayload {
  consentId: string;
  visitorId: string;
  domainKey: string;
  configVersion: number;
  savedAt: string;
}

function base64UrlToString(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof atob === 'undefined') return '';
  const binary = atob(padded);
  return decodeURIComponent(
    Array.from(binary, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
  );
}

export function parseConsentToken(token: string): ConsentTokenPayload | null {
  const [body] = token.split('.');
  if (!body) return null;
  try {
    return JSON.parse(base64UrlToString(body)) as ConsentTokenPayload;
  } catch {
    return null;
  }
}
