import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ConsentTokenPayload {
  consentId: string;
  visitorId: string;
  domainKey: string;
  configVersion: number;
  savedAt: string;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function signConsentToken(secret: string, payload: ConsentTokenPayload) {
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyConsentToken(secret: string, token: string): ConsentTokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(body)) as ConsentTokenPayload;
  } catch {
    return null;
  }
}

export function createVisitorVerificationToken(secret: string, visitorId: string, domainKey: string) {
  return createHmac('sha256', secret)
    .update(`${domainKey}:${visitorId}`)
    .digest('hex')
    .slice(0, 32);
}

export function deriveSharedCookieDomain(hostname: string): string | null {
  if (!hostname || hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  return `.${parts.slice(-2).join('.')}`;
}
