export type BannerLayout =
  | 'bottom_bar'
  | 'top_bar'
  | 'center_modal'
  | 'corner_popup'
  | 'fullscreen'
  | 'side_panel'
  | 'compact'
  | 'multi_step_modal';

export interface BannerBehavior {
  displayOnFirstVisit?: boolean;
  displayAfterConsentExpires?: boolean;
  displayWhenPolicyChanges?: boolean;
  showOnPages?: string[];
  excludePages?: string[];
  displayDelayMs?: number;
  displayAfterScrollPercent?: number;
  displayAfterInteraction?: boolean;
  blockInteractionUntilChoice?: boolean;
  respectGlobalPrivacyControl?: boolean;
  rememberChoice?: boolean;
  consentExpirationDays?: number;
  allowClose?: boolean;
  clearCookiesOnWithdrawal?: boolean;
}

export interface BannerTheme {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonTextColor?: string;
  buttonStyle?: 'filled' | 'outline' | 'soft';
  borderRadius?: string;
  fontFamily?: string;
  fontSize?: string;
  spacing?: string;
  shadow?: string;
  overlayOpacity?: number;
  logoUrl?: string;
  iconUrl?: string;
  customCss?: string;
}

export interface PrivacyTriggerConfig {
  enabled?: boolean;
  mode?: 'floating_icon' | 'footer_link' | 'api_only';
  label?: string;
  position?: 'bottom-left' | 'bottom-right';
  footerSelector?: string;
}

export interface BannerContent {
  title: string;
  description: string;
  contentFormat?: 'plain' | 'basic_html';
  acceptButton: string;
  rejectButton: string;
  preferencesButton: string;
  saveButton?: string;
  closeButton?: string;
  legalNotice?: string;
  footerContent?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  /** When true, show a dedicated Do Not Sell / Share control (CCPA/CPRA). */
  showDoNotSell?: boolean;
  doNotSellLabel?: string;
  categoryDescriptions?: Record<string, string>;
  vendorDescriptions?: Record<string, string>;
  layout?: BannerLayout;
  behavior?: BannerBehavior;
  theme?: BannerTheme;
  privacyTrigger?: PrivacyTriggerConfig;
  embedPlaceholders?: Record<string, { title?: string; description?: string; allowLabel?: string }>;
  translations?: Record<
    string,
    {
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
  >;
}

export interface CategorySnapshot {
  slug: string;
  name: string;
  description?: string | null;
  required?: boolean;
  enabled?: boolean;
  defaultState?: string;
  vendorPurposes?: string[] | null;
  scriptMappings?: {
    scripts?: string[];
    iframes?: string[];
    pixels?: string[];
    cookies?: string[];
  } | null;
}

export interface ConsentMetadata {
  savedAt: string | null;
  expiresAt: string | null;
  policyVersionId: string | null;
  policyVersionNumber: number | null;
  region: string | null;
  language: string | null;
}

export interface CmpConfig {
  domainKey: string;
  hostname?: string;
  configVersion: number;
  policyVersionId?: string | null;
  policyVersionNumber?: number | null;
  consentMetadata?: ConsentMetadata | null;
  region?: string | null;
  visitorGeo?: {
    country: string | null;
    region: string | null;
    language: string;
    timezone: string | null;
    source: string;
  } | null;
  applicableRegulation?: string | null;
  regulationProfileId?: string | null;
  matchedRegionalRuleId?: string | null;
  autoBlocking?: boolean;
  debugMode?: boolean;
  vendorPatterns?: Array<{
    vendor: string;
    category: string;
    patterns: string[];
    resourceTypes?: string[];
  }>;
  shareVisitorAcrossSubdomains?: boolean;
  visitorCookieDomain?: string | null;
  requiresRenewal?: boolean;
  regulationConfig?: {
    googleConsentMode?: {
      enabled?: boolean;
      mode?: 'basic' | 'advanced';
      adsDataRedaction?: boolean;
      urlPassthrough?: boolean;
      waitForUpdate?: number;
      regionDefaults?: Record<string, Record<string, 'granted' | 'denied'>>;
    };
    geo?: {
      enabled?: boolean;
      defaultProfileId?: string;
      regionalRules?: Array<{
        id: string;
        name: string;
        priority: number;
        conditions: Record<string, unknown>;
        profileId: string;
      }>;
    };
  } | null;
  categories?: CategorySnapshot[];
  banner?: BannerContent | null;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  activeLanguage?: string;
  crossDomainGroup?: {
    groupId: string;
    shareConsent: boolean;
    memberDomainKeys: string[];
  } | null;
  whiteLabel?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    cmpBrandName?: string | null;
    hidePlatformBranding?: boolean;
  } | null;
}

export function normalizePath(pathname: string) {
  return pathname.replace(/\/$/, '') || '/';
}

export function matchesPageRule(pathname: string, patterns: string[] | undefined) {
  if (!patterns || patterns.length === 0) return true;
  const path = normalizePath(pathname);
  return patterns.some((pattern) => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
}

export function shouldShowBanner(options: {
  pathname: string;
  behavior?: BannerBehavior;
  hasStoredConsent: boolean;
  requiresRenewal?: boolean;
  gpcEnabled?: boolean;
}) {
  const behavior = options.behavior ?? {};
  if (behavior.respectGlobalPrivacyControl && options.gpcEnabled) {
    return false;
  }
  if (behavior.showOnPages?.length && !matchesPageRule(options.pathname, behavior.showOnPages)) {
    return false;
  }
  if (behavior.excludePages?.length && matchesPageRule(options.pathname, behavior.excludePages)) {
    return false;
  }
  if (options.requiresRenewal) return true;
  if (options.hasStoredConsent) {
    return false;
  }
  if (behavior.displayOnFirstVisit === false && !options.hasStoredConsent) {
    return false;
  }
  return true;
}

export function buildConsentState(
  categories: CategorySnapshot[],
  mode: 'accept_all' | 'reject_all' | 'custom',
  custom?: Record<string, boolean>,
) {
  const state: Record<string, boolean> = {};
  for (const category of categories) {
    if (!category.enabled) continue;
    if (category.required || category.slug === 'strictly_necessary') {
      state[category.slug] = true;
      continue;
    }
    if (mode === 'accept_all') {
      state[category.slug] = true;
    } else if (mode === 'reject_all') {
      state[category.slug] = false;
    } else {
      state[category.slug] = custom?.[category.slug] ?? category.defaultState === 'ENABLED';
    }
  }
  return state;
}

export function isModalLayout(layout: BannerLayout | undefined) {
  return (
    layout === 'center_modal' ||
    layout === 'fullscreen' ||
    layout === 'side_panel' ||
    layout === 'multi_step_modal'
  );
}

export function getCategoryDescription(
  banner: BannerContent,
  category: CategorySnapshot,
): string | null {
  const override = banner.categoryDescriptions?.[category.slug];
  if (override?.trim()) return override.trim();
  return category.description ?? null;
}

export function getVendorDescription(banner: BannerContent, vendorKey: string): string | null {
  const override = banner.vendorDescriptions?.[vendorKey];
  return override?.trim() ? override.trim() : null;
}
