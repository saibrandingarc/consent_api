import { normalizeRegionCode } from './region-codes';

/** Optional IP geolocation fallback when CDN headers are absent. */
export interface IpGeoResult {
  country: string | null;
  region: string | null;
  source: 'ip_api';
}

function normalizeCountry(code: string | undefined | null): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized || normalized === 'XX') return null;
  return normalized.length === 2 ? normalized : null;
}

/**
 * Resolve country from client IP using a public geo API.
 * Disabled unless GEOIP_ENABLED=true. Never throws.
 */
export async function lookupCountryFromIp(ip: string | undefined | null): Promise<IpGeoResult | null> {
  if (process.env.GEOIP_ENABLED !== 'true') return null;
  if (!ip || ip === '127.0.0.1' || ip.startsWith('::')) return null;

  const cleanIp = ip.replace(/^::ffff:/, '');
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      country_code?: string;
      region?: string;
      region_code?: string;
    };
    const country = normalizeCountry(data.country_code);
    if (!country) return null;
    return {
      country,
      region: normalizeRegionCode(data.region_code) ?? normalizeRegionCode(data.region),
      source: 'ip_api',
    };
  } catch {
    return null;
  }
}

export function extractClientIp(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (raw) return raw.split(',')[0]?.trim() ?? null;
  const realIp = headers['x-real-ip'];
  if (Array.isArray(realIp)) return realIp[0] ?? null;
  return realIp ?? null;
}
