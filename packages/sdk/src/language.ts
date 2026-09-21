const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'yi']);

export interface BannerTranslationEntry {
  title?: string;
  description?: string;
  acceptButton?: string;
  rejectButton?: string;
  preferencesButton?: string;
  saveButton?: string;
  closeButton?: string;
  legalNotice?: string;
  footerContent?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  categoryDescriptions?: Record<string, string>;
  categoryNames?: Record<string, string>;
  vendorDescriptions?: Record<string, string>;
  privacyTrigger?: { label?: string };
}

export interface BannerContentWithTranslations {
  title: string;
  description: string;
  acceptButton: string;
  rejectButton: string;
  preferencesButton: string;
  saveButton?: string;
  closeButton?: string;
  legalNotice?: string;
  footerContent?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  categoryDescriptions?: Record<string, string>;
  vendorDescriptions?: Record<string, string>;
  privacyTrigger?: { label?: string };
  translations?: Record<string, BannerTranslationEntry>;
}

const LANGUAGE_STORAGE_PREFIX = 'cmp_lang_';

export function normalizeLanguageCode(language: string | null | undefined): string {
  if (!language?.trim()) return 'en';
  const normalized = language.trim().toLowerCase().replace('_', '-');
  const base = normalized.split('-')[0] ?? normalized;
  return base.slice(0, 10);
}

export function isRtlLanguage(language: string | null | undefined): boolean {
  return RTL_LANGUAGES.has(normalizeLanguageCode(language));
}

export function pickSupportedLanguage(
  candidate: string,
  supportedLanguages: string[] | null | undefined,
  fallback = 'en',
): string {
  const supported = (supportedLanguages ?? ['en']).map(normalizeLanguageCode);
  const normalized = normalizeLanguageCode(candidate);
  if (supported.includes(normalized)) return normalized;
  const prefixMatch = supported.find((lang) => lang.startsWith(normalized) || normalized.startsWith(lang));
  if (prefixMatch) return prefixMatch;
  if (supported.includes(fallback)) return fallback;
  return supported[0] ?? fallback;
}

export function resolveLanguagePriority(options: {
  urlParam?: string | null;
  storedPreference?: string | null;
  scriptAttribute?: string | null;
  browserLanguage?: string | null;
  defaultLanguage?: string | null;
  supportedLanguages?: string[] | null;
}): string {
  const fallback = normalizeLanguageCode(options.defaultLanguage ?? 'en');
  const supported = options.supportedLanguages ?? ['en'];
  const candidates = [
    options.urlParam,
    options.storedPreference,
    options.scriptAttribute,
    options.browserLanguage,
    fallback,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    return pickSupportedLanguage(candidate, supported, fallback);
  }

  return pickSupportedLanguage(fallback, supported, 'en');
}

export function findTranslationEntry(
  translations: Record<string, BannerTranslationEntry> | null | undefined,
  language: string,
): BannerTranslationEntry | null {
  if (!translations) return null;
  const normalized = normalizeLanguageCode(language);
  if (translations[normalized]) return translations[normalized];
  const loose = Object.keys(translations).find((key) => normalizeLanguageCode(key) === normalized);
  return loose ? translations[loose] ?? null : null;
}

export function applyBannerTranslation(
  banner: BannerContentWithTranslations,
  language: string,
): Omit<BannerContentWithTranslations, 'translations'> {
  const translation = findTranslationEntry(banner.translations, language);
  if (!translation) {
    const { translations: _omit, ...rest } = banner;
    return rest;
  }

  const result: BannerContentWithTranslations = {
    ...banner,
    title: translation.title?.trim() || banner.title,
    description: translation.description?.trim() || banner.description,
    acceptButton: translation.acceptButton?.trim() || banner.acceptButton,
    rejectButton: translation.rejectButton?.trim() || banner.rejectButton,
    preferencesButton: translation.preferencesButton?.trim() || banner.preferencesButton,
    saveButton: translation.saveButton?.trim() || banner.saveButton,
    closeButton: translation.closeButton?.trim() || banner.closeButton,
    legalNotice: translation.legalNotice?.trim() || banner.legalNotice,
    footerContent: translation.footerContent?.trim() || banner.footerContent,
    privacyPolicyUrl: translation.privacyPolicyUrl?.trim() || banner.privacyPolicyUrl,
    cookiePolicyUrl: translation.cookiePolicyUrl?.trim() || banner.cookiePolicyUrl,
    categoryDescriptions: {
      ...(banner.categoryDescriptions ?? {}),
      ...(translation.categoryDescriptions ?? {}),
    },
    vendorDescriptions: {
      ...(banner.vendorDescriptions ?? {}),
      ...(translation.vendorDescriptions ?? {}),
    },
    privacyTrigger: {
      ...(banner.privacyTrigger ?? {}),
      label: translation.privacyTrigger?.label?.trim() || banner.privacyTrigger?.label,
    },
  };

  const { translations: _omit, ...withoutTranslations } = result;
  return withoutTranslations;
}

export function applyCategoryTranslations<T extends { slug: string; name: string; description?: string | null }>(
  categories: T[] | null | undefined,
  translation: BannerTranslationEntry | null,
): T[] {
  if (!categories?.length || !translation) return categories ?? [];
  const names = translation.categoryNames ?? {};
  const descriptions = translation.categoryDescriptions ?? {};

  return categories.map((category) => ({
    ...category,
    name: names[category.slug]?.trim() || category.name,
    description: descriptions[category.slug]?.trim() || category.description,
  }));
}

export function readStoredLanguagePreference(domainKey: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(`${LANGUAGE_STORAGE_PREFIX}${domainKey}`);
  } catch {
    return null;
  }
}

export function writeStoredLanguagePreference(domainKey: string, language: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${LANGUAGE_STORAGE_PREFIX}${domainKey}`, normalizeLanguageCode(language));
  } catch {
    // ignore quota / privacy mode
  }
}

export function readUrlLanguageParam(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('cmp_lang');
}
