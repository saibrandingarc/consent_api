export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  requestId?: string;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

const TOKEN_KEY = 'cmp_tokens';

export function getApiUrl(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:4000/api/v1';
}

export function getStoredTokens(): StoredTokens | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: StoredTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

async function refreshAccessToken(apiUrl: string): Promise<StoredTokens | null> {
  const tokens = getStoredTokens();
  if (!tokens?.refreshToken) return null;

  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  const result = (await response.json()) as ApiResult<StoredTokens>;
  if (!result.ok || !result.data) return null;
  setStoredTokens(result.data);
  return result.data;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string; skipAuth?: boolean } = {},
): Promise<ApiResult<T>> {
  const apiUrl = getApiUrl();
  const { accessToken, skipAuth, headers, ...rest } = options;
  let token = accessToken ?? (skipAuth ? undefined : getStoredTokens()?.accessToken);

  const doFetch = (bearer?: string) =>
    fetch(`${apiUrl}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...headers,
      },
    });

  let response: Response;
  try {
    response = await doFetch(token);
  } catch {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Cannot reach the API at ${apiUrl}. Make sure the API server is running.`,
      },
    };
  }

  if (response.status === 401 && !skipAuth && !accessToken) {
    const refreshed = await refreshAccessToken(apiUrl);
    if (refreshed) {
      try {
        response = await doFetch(refreshed.accessToken);
      } catch {
        return {
          ok: false,
          error: {
            code: 'NETWORK_ERROR',
            message: `Cannot reach the API at ${apiUrl}. Make sure the API server is running.`,
          },
        };
      }
    }
  }

  return response.json() as Promise<ApiResult<T>>;
}

export {
  getContrastRatio,
  meetsWcagAA,
  getBannerContrastWarnings,
  type ContrastWarning,
} from './contrast';
export { sanitizeBannerCustomCss, scopeBannerCustomCss } from './banner-css';
export { BANNER_TEXT_TEMPLATES, type BannerTextTemplate } from './banner-templates';
export { deriveSharedCookieDomain } from './cookie-domain';
export {
  EU_COUNTRIES,
  COUNTRY_GROUP_MEMBERS,
  countryMatchesGroup,
  countryInGroups,
} from './geo/country-groups';
export {
  detectCountryFromHeaders,
  detectRegionFromHeaders,
  detectClientGeoHints,
  mergeDetectedGeo,
  type DetectedGeo,
  type GeoDetectionSource,
} from './geo/geo-detection';
export {
  REGULATION_PROFILES,
  getRegulationProfile,
  listRegulationProfiles,
  type RegulationProfile,
  type ConsentModel,
} from './geo/regulation-profiles';
export {
  resolveRegionalRule,
  resolveGeoRegulation,
  applyRegulationProfile,
  DEFAULT_REGIONAL_RULES,
  type RegionalRule,
  type GeoRegulationSettings,
  type ResolvedGeoRegulation,
} from './geo/regional-rules';
export { normalizeRegionCode } from './geo/region-codes';
export {
  CONSENT_TEMPLATES,
  getConsentTemplate,
  resolveConsentTemplateBannerText,
  type ConsentTemplateId,
  type ConsentTemplateDefinition,
} from './geo/consent-templates';
export {
  lookupCountryFromIp,
  extractClientIp,
  type IpGeoResult,
} from './geo/ip-geolocation';
export {
  RTL_LANGUAGES,
  COMMON_LANGUAGE_OPTIONS,
  BANNER_TRANSLATABLE_FIELDS,
  normalizeLanguageCode,
  isRtlLanguage,
  pickSupportedLanguage,
  resolveLanguagePriority,
  findTranslationEntry,
  applyBannerTranslation,
  applyCategoryTranslations,
  listMissingBannerTranslations,
  listMissingCategoryTranslations,
  suggestBannerTranslations,
  type BannerTranslatableField,
  type BannerTranslationEntry,
  type BannerSourceForTranslation,
} from './language/language';

export { computeGroupVisitorId } from './enterprise/group-visitor';
export {
  classifyCookieHeuristic,
  isSuspiciousNecessaryClassification,
  generateBannerTextHeuristic,
  type CookieClassificationHint,
} from './ai/heuristics';
export function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
