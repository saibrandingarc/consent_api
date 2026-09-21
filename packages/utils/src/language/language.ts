import { LOCALIZED_BANNER_DEFAULTS, PHRASE_TRANSLATIONS } from './translation-phrases';

export const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'yi']);

export const COMMON_LANGUAGE_OPTIONS: Array<{ code: string; label: string; rtl?: boolean }> = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ar', label: 'Arabic', rtl: true },
  { code: 'he', label: 'Hebrew', rtl: true },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'tr', label: 'Turkish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'ru', label: 'Russian' },
];

export const BANNER_TRANSLATABLE_FIELDS = [
  'title',
  'description',
  'acceptButton',
  'rejectButton',
  'preferencesButton',
  'saveButton',
  'closeButton',
  'legalNotice',
  'footerContent',
] as const;

export type BannerTranslatableField = (typeof BANNER_TRANSLATABLE_FIELDS)[number];

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

export interface BannerSourceForTranslation {
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
  privacyTrigger?: { label?: string };
}

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
    const picked = pickSupportedLanguage(candidate, supported, fallback);
    if (picked) return picked;
  }

  return pickSupportedLanguage(fallback, supported, 'en');
}

export function findTranslationEntry(
  translations: Record<string, BannerTranslationEntry> | null | undefined,
  language: string,
  supportedLanguages?: string[] | null,
): BannerTranslationEntry | null {
  if (!translations) return null;
  const normalized = normalizeLanguageCode(language);
  if (translations[normalized]) return translations[normalized];

  const supported = (supportedLanguages ?? Object.keys(translations)).map(normalizeLanguageCode);
  const fromSupported = supported.find((code) => translations[code]);
  if (fromSupported && translations[fromSupported]) return translations[fromSupported];

  const loose = Object.keys(translations).find((key) => normalizeLanguageCode(key) === normalized);
  return loose ? translations[loose] ?? null : null;
}

export function applyBannerTranslation<T extends BannerSourceForTranslation & {
  categoryDescriptions?: Record<string, string>;
  vendorDescriptions?: Record<string, string>;
  translations?: Record<string, BannerTranslationEntry>;
}>(
  banner: T,
  language: string,
  supportedLanguages?: string[] | null,
): Omit<T, 'translations'> {
  const translation = findTranslationEntry(banner.translations, language, supportedLanguages);
  if (!translation) {
    const { translations: _omit, ...rest } = banner;
    return rest;
  }

  const mergedCategoryDescriptions = {
    ...(banner.categoryDescriptions ?? {}),
    ...(translation.categoryDescriptions ?? {}),
  };
  const mergedVendorDescriptions = {
    ...(banner.vendorDescriptions ?? {}),
    ...(translation.vendorDescriptions ?? {}),
  };

  const result = {
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
    categoryDescriptions: mergedCategoryDescriptions,
    vendorDescriptions: mergedVendorDescriptions,
    privacyTrigger: {
      ...(banner.privacyTrigger ?? {}),
      ...(translation.privacyTrigger ?? {}),
      label: translation.privacyTrigger?.label?.trim() || banner.privacyTrigger?.label,
    },
  };

  const { translations: _omit, ...withoutTranslations } = result;
  return withoutTranslations;
}

export function applyCategoryTranslations(
  categories: Array<{ slug: string; name: string; description?: string | null }> | null | undefined,
  translation: BannerTranslationEntry | null,
): Array<{ slug: string; name: string; description?: string | null }> {
  if (!categories?.length || !translation) return categories ?? [];
  const names = translation.categoryNames ?? {};
  const descriptions = translation.categoryDescriptions ?? {};

  return categories.map((category) => ({
    ...category,
    name: names[category.slug]?.trim() || category.name,
    description: descriptions[category.slug]?.trim() || category.description,
  }));
}

export function listMissingBannerTranslations(
  source: BannerSourceForTranslation,
  translation: BannerTranslationEntry | null | undefined,
): BannerTranslatableField[] {
  return BANNER_TRANSLATABLE_FIELDS.filter((field) => {
    const sourceValue = source[field];
    if (!sourceValue?.trim()) return false;
    const translated = translation?.[field];
    return !translated?.trim();
  });
}

export function listMissingCategoryTranslations(
  categories: Array<{ slug: string; name: string; description?: string | null }>,
  translation: BannerTranslationEntry | null | undefined,
): string[] {
  const missing: string[] = [];
  for (const category of categories) {
    if (category.name?.trim() && !translation?.categoryNames?.[category.slug]?.trim()) {
      missing.push(`${category.slug}:name`);
    }
    if (category.description?.trim() && !translation?.categoryDescriptions?.[category.slug]?.trim()) {
      missing.push(`${category.slug}:description`);
    }
  }
  return missing;
}

function suggestPhrase(sourceText: string, targetLanguage: string): string | undefined {
  const lang = normalizeLanguageCode(targetLanguage);
  const exact = PHRASE_TRANSLATIONS[sourceText]?.[lang];
  if (exact) return exact;
  return undefined;
}

export function suggestBannerTranslations(
  targetLanguage: string,
  source: BannerSourceForTranslation,
): BannerTranslationEntry {
  const lang = normalizeLanguageCode(targetLanguage);
  const defaults = LOCALIZED_BANNER_DEFAULTS[lang];

  const suggestField = (field: BannerTranslatableField, fallback?: string): string | undefined => {
    const sourceText = source[field];
    if (!sourceText?.trim()) return undefined;
    const fromPhrase = suggestPhrase(sourceText, lang);
    if (fromPhrase) return fromPhrase;
    if (fallback) return fallback;
    return undefined;
  };

  if (defaults) {
    return {
      title: suggestField('title', defaults.title),
      description: suggestField('description', defaults.description),
      acceptButton: suggestField('acceptButton', defaults.acceptButton),
      rejectButton: suggestField('rejectButton', defaults.rejectButton),
      preferencesButton: suggestField('preferencesButton', defaults.preferencesButton),
      saveButton: suggestField('saveButton', defaults.saveButton),
      closeButton: suggestField('closeButton', defaults.closeButton),
      legalNotice: suggestField('legalNotice', defaults.legalNotice),
      footerContent: suggestField('footerContent', defaults.footerContent),
      privacyTrigger: {
        label:
          suggestPhrase(source.privacyTrigger?.label ?? '', lang) ?? defaults.privacyTriggerLabel,
      },
    };
  }

  return {
    title: suggestField('title'),
    description: suggestField('description'),
    acceptButton: suggestField('acceptButton'),
    rejectButton: suggestField('rejectButton'),
    preferencesButton: suggestField('preferencesButton'),
    saveButton: suggestField('saveButton'),
    closeButton: suggestField('closeButton'),
    legalNotice: suggestField('legalNotice'),
    footerContent: suggestField('footerContent'),
    privacyTrigger: {
      label: suggestPhrase(source.privacyTrigger?.label ?? '', lang),
    },
  };
}
