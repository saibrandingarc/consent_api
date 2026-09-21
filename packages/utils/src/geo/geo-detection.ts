import { normalizeRegionCode } from './region-codes';

export type GeoDetectionSource =
  | 'cdn'
  | 'accept_language'
  | 'client'
  | 'domain'
  | 'preview'
  | 'disabled'
  | 'ip_api';

export interface DetectedGeo {
  country: string | null;
  region: string | null;
  language: string;
  timezone: string | null;
  source: GeoDetectionSource;
}

const CDN_COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-country-code',
  'cloudfront-viewer-country',
  'x-appengine-country',
  'x-geo-country',
] as const;

const CDN_REGION_HEADERS = [
  'cloudfront-viewer-country-region',
  'cf-region-code',
  'x-geo-region',
  'x-appengine-region',
  'x-client-region',
] as const;

function normalizeCountry(value: string | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  if (!code || code === 'XX' || code === 'T1') return null;
  return code.length === 2 ? code : null;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

export function detectRegionFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  for (const header of CDN_REGION_HEADERS) {
    const region = normalizeRegionCode(headerValue(headers, header));
    if (region) return region;
  }
  return null;
}

export function detectCountryFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): { country: string | null; region: string | null; source: GeoDetectionSource } {
  const regionFromHeaders = detectRegionFromHeaders(headers);

  for (const header of CDN_COUNTRY_HEADERS) {
    const country = normalizeCountry(headerValue(headers, header));
    if (country) return { country, region: regionFromHeaders, source: 'cdn' };
  }

  const acceptLanguage = headerValue(headers, 'accept-language');
  if (acceptLanguage?.includes('-')) {
    const part = acceptLanguage.split(',')[0]?.split('-')[1];
    const country = normalizeCountry(part);
    if (country) return { country, region: regionFromHeaders, source: 'accept_language' };
  }

  return { country: null, region: regionFromHeaders, source: 'cdn' };
}

export function detectClientGeoHints(
  domainRegion?: string | null,
): Pick<DetectedGeo, 'country' | 'region' | 'language' | 'timezone'> {
  const language =
    typeof navigator !== 'undefined'
      ? navigator.language || (navigator.languages?.[0] ?? 'en')
      : 'en';
  const timezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
      : null;

  const localeCountry = language.includes('-')
    ? normalizeCountry(language.split('-')[1] ?? undefined)
    : null;
  const country = localeCountry ?? null;
  // Browser locale alone cannot reliably detect US state; prefer explicit domain region.
  const region = normalizeRegionCode(domainRegion) ?? null;

  return { country, region, language, timezone };
}

export function mergeDetectedGeo(
  server: { country: string | null; region?: string | null; source: GeoDetectionSource },
  client: Pick<DetectedGeo, 'country' | 'region' | 'language' | 'timezone'>,
  domainRegion?: string | null,
  geoDisabled?: boolean,
  previewCountry?: string | null,
  previewRegion?: string | null,
): DetectedGeo {
  if (previewCountry) {
    const country = normalizeCountry(previewCountry);
    return {
      country,
      region: normalizeRegionCode(previewRegion) ?? country ?? normalizeRegionCode(domainRegion),
      language: client.language,
      timezone: client.timezone,
      source: 'preview',
    };
  }

  if (geoDisabled) {
    return {
      country: client.country,
      region: normalizeRegionCode(domainRegion) ?? normalizeRegionCode(client.region),
      language: client.language,
      timezone: client.timezone,
      source: 'disabled',
    };
  }

  const country = server.country ?? client.country;
  const region =
    normalizeRegionCode(client.region) ??
    normalizeRegionCode(server.region) ??
    normalizeRegionCode(domainRegion) ??
    null;

  return {
    country,
    region,
    language: client.language,
    timezone: client.timezone,
    source: server.country ? server.source : country ? 'client' : domainRegion ? 'domain' : 'client',
  };
}
