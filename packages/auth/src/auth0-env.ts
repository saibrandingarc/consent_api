/**
 * Shared Auth0 env helpers for web/admin. No secrets — apps own Auth0Client instances.
 */

export function getAuth0ClientId(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string | undefined {
  return (
    env.CM_AUTH0_CLIENT_ID?.trim() ||
    env.AUTH0_CLIENT_ID?.trim() ||
    env.NEXT_PUBLIC_AUTH0_CLIENT_ID?.trim() ||
    undefined
  );
}

export function getAuth0ClientSecret(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string | undefined {
  return (
    env.CM_AUTH0_CLIENT_SECRET?.trim() ||
    env.AUTH0_CLIENT_SECRET?.trim() ||
    env.cm_auth0_client_secret?.trim() ||
    undefined
  );
}

export function isAuth0Configured(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return Boolean(
    env.AUTH0_DOMAIN &&
      getAuth0ClientId(env) &&
      getAuth0ClientSecret(env) &&
      env.AUTH0_SECRET,
  );
}

export function isAuthUiEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  if (isAuth0Configured(env)) return true;
  if (env.NEXT_PUBLIC_AUTH0_CONFIGURED === 'true') return true;
  if (getAuth0ClientId(env) && env.AUTH0_DOMAIN?.trim()) return true;
  return false;
}

export function getAppBaseUrl(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const url =
    env.APP_BASE_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.NEXT_PUBLIC_ADMIN_URL?.trim() ||
    'http://localhost:3000';
  return url.replace(/\/$/, '');
}

type HeaderLike = { get(name: string): string | null };

function isLocalAppBase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return url.includes('localhost') || url.includes('127.0.0.1');
  }
}

export function resolveAppBaseUrl(
  request?: { headers: HeaderLike; nextUrl: { protocol: string; host: string } },
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const fromEnv = getAppBaseUrl(env);
  if (!request || !isLocalAppBase(fromEnv)) {
    return fromEnv;
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || request.nextUrl.host;
  if (!host || host.startsWith('0.0.0.0')) {
    return fromEnv;
  }

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const proto =
    forwardedProto?.split(',')[0]?.trim() || request.nextUrl.protocol.replace(':', '') || 'https';
  return `${proto}://${host}`;
}

export function resolveAppBaseUrlFromHeaders(
  headers: HeaderLike,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const fromEnv = getAppBaseUrl(env);
  if (!isLocalAppBase(fromEnv)) {
    return fromEnv;
  }

  const forwardedHost = headers.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || headers.get('host');
  if (!host || host.startsWith('0.0.0.0')) {
    return fromEnv;
  }

  const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  return `${proto}://${host}`;
}

export function getAuth0ClientOptions(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): { appBaseUrl?: string } {
  const appBaseUrl = env.APP_BASE_URL?.trim();
  return appBaseUrl ? { appBaseUrl } : {};
}

export function getRequestHost(
  headers: HeaderLike,
  fallbackHost: string,
): string {
  const forwardedHost = headers.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || headers.get('host') || fallbackHost;
  return host.trim().toLowerCase();
}

export function appBaseUrlMatchesHost(
  host: string,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) return false;
  if (normalizedHost.startsWith('0.0.0.0')) {
    return false;
  }

  const fromEnv = getAppBaseUrl(env);
  if (isLocalAppBase(fromEnv)) {
    return true;
  }

  if (normalizedHost.startsWith('127.0.0.1')) {
    return false;
  }

  try {
    return new URL(fromEnv).host.toLowerCase() === normalizedHost;
  } catch {
    return false;
  }
}

export const AUTH0_CALLBACK_PATH = '/auth/callback';
export const AUTH0_LOGIN_PATH = '/auth/login';
export const AUTH0_LOGOUT_PATH = '/auth/logout';
