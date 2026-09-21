export interface DetectedRegion {
  region: string | null;
  language: string;
  timezone: string | null;
  country?: string | null;
}

export function detectClientGeoHints(domainRegion?: string | null) {
  const language =
    typeof navigator !== 'undefined'
      ? navigator.language || (navigator.languages?.[0] ?? 'en')
      : 'en';
  const timezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
      : null;

  const localeCountry = language.includes('-')
    ? language.split('-')[1]?.toUpperCase() ?? null
    : null;
  const country = localeCountry ?? null;
  const region = domainRegion ?? localeCountry ?? timezone?.split('/')[0]?.toUpperCase() ?? null;

  return { country, region, language, timezone };
}

export function detectVisitorRegion(domainRegion?: string | null): DetectedRegion {
  return detectClientGeoHints(domainRegion);
}
