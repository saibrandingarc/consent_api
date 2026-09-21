export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

function envFlag(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (['true', '1', 'yes', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'off'].includes(raw)) return false;
  return defaultValue;
}

export const API_CONFIG = {
  port: Number(process.env.API_PORT ?? 4000),
  prefix: process.env.API_PREFIX ?? 'api/v1',
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;

export const JWT_CONFIG = {
  accessSecret: () => getEnv('JWT_ACCESS_SECRET'),
  refreshSecret: () => getEnv('JWT_REFRESH_SECRET'),
  accessExpiresIn: '15m' as const,
  refreshExpiresIn: '7d' as const,
} as const;

export const APP_URLS = {
  admin: process.env.ADMIN_URL ?? 'http://localhost:3001',
  api: process.env.API_URL ?? 'http://localhost:4000',
  web: process.env.WEB_URL ?? 'http://localhost:3000',
} as const;

/**
 * Public API origin for absolute URLs (install snippet, verify links).
 * Accepts API_URL with or without a trailing /api/vN prefix so deploy envs
 * that set either shape do not produce /api/v1/api/v1/... paths.
 */
export function apiOrigin(url: string = APP_URLS.api): string {
  return url.replace(/\/+$/, '').replace(/\/api\/v\d+$/i, '');
}

export const CMP_CONFIG = {
  sdkPath: `/${API_CONFIG.prefix}/public/cmp/sdk.js`,
  get sdkUrl() {
    return `${apiOrigin()}${this.sdkPath}`;
  },
} as const;

export const SECURITY_CONFIG = {
  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5),
  lockoutDurationMinutes: Number(process.env.LOCKOUT_DURATION_MINUTES ?? 15),
} as const;

export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM ?? 'CMP <noreply@localhost>',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
} as const;

export const AUTH_CONFIG = {
  /** When false, users can register and sign in without verifying email. */
  get emailVerificationEnabled() {
    return envFlag('EMAIL_VERIFICATION_ENABLED', Boolean(EMAIL_CONFIG.smtpHost));
  },
} as const;

export const AUTH0_CONFIG = {
  get enabled() {
    const clientId =
      process.env.CM_AUTH0_CLIENT_ID?.trim() || process.env.AUTH0_CLIENT_ID?.trim();
    return Boolean(process.env.AUTH0_DOMAIN?.trim() && clientId);
  },
  get apiAuthEnabled() {
    return Boolean(
      process.env.AUTH0_DOMAIN?.trim() &&
        process.env.AUTH0_AUDIENCE?.trim() &&
        (process.env.AUTH0_ISSUER_URL?.trim() || process.env.AUTH0_DOMAIN?.trim()),
    );
  },
  domain: process.env.AUTH0_DOMAIN?.trim() ?? '',
  get clientId() {
    return process.env.CM_AUTH0_CLIENT_ID?.trim() || process.env.AUTH0_CLIENT_ID?.trim() || '';
  },
  audience: process.env.AUTH0_AUDIENCE?.trim() ?? '',
  get issuerUrl() {
    const explicit = process.env.AUTH0_ISSUER_URL?.trim() || process.env.AUTH0_ISSUER_BASE_URL?.trim();
    if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;
    return this.domain ? `https://${this.domain}/` : '';
  },
} as const;

export const DOMAIN_CONFIG = {
  /**
   * When true, domains are marked verified as soon as an authenticated org admin adds them.
   * No DNS, meta tag, or verification file required on the website.
   */
  get autoVerifyOnCreate() {
    return envFlag('DOMAIN_AUTO_VERIFY', API_CONFIG.nodeEnv === 'development');
  },
  /**
   * When true, the first CMP SDK heartbeat auto-verifies the domain (no separate verify step).
   */
  get autoVerifyOnHeartbeat() {
    return envFlag('DOMAIN_AUTO_VERIFY_ON_HEARTBEAT', true);
  },
} as const;
