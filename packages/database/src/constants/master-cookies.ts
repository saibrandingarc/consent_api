export interface CookieDetectionPatterns {
  exact?: string[];
  prefix?: string[];
  suffix?: string[];
  regex?: string[];
  providerDomains?: string[];
  scriptSources?: string[];
  networkEndpoints?: string[];
}

export interface MasterCookieSeed {
  cookieName: string;
  provider: string;
  providerDomain?: string;
  description: string;
  purpose: string;
  category: string;
  duration: string;
  dataCollected?: string;
  isThirdParty: boolean;
  privacyPolicyUrl?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  aliases?: string[];
  detectionPatterns: CookieDetectionPatterns;
}

export const MASTER_COOKIE_DEFINITIONS: MasterCookieSeed[] = [
  {
    cookieName: '_ga',
    provider: 'Google Analytics',
    providerDomain: 'google-analytics.com',
    description: 'Registers a unique ID used to generate statistical data on how the visitor uses the website.',
    purpose: 'Analytics',
    category: 'analytics',
    duration: '2 years',
    dataCollected: 'Usage statistics, page views',
    isThirdParty: true,
    privacyPolicyUrl: 'https://policies.google.com/privacy',
    riskLevel: 'MEDIUM',
    aliases: ['_ga_*'],
    detectionPatterns: {
      exact: ['_ga'],
      prefix: ['_ga_'],
      providerDomains: ['google-analytics.com'],
      scriptSources: ['googletagmanager.com', 'google-analytics.com'],
    },
  },
  {
    cookieName: '_gid',
    provider: 'Google Analytics',
    providerDomain: 'google-analytics.com',
    description: 'Registers a unique ID used to distinguish users for analytics.',
    purpose: 'Analytics',
    category: 'analytics',
    duration: '24 hours',
    isThirdParty: true,
    privacyPolicyUrl: 'https://policies.google.com/privacy',
    riskLevel: 'MEDIUM',
    detectionPatterns: {
      exact: ['_gid'],
      providerDomains: ['google-analytics.com'],
    },
  },
  {
    cookieName: '_gat',
    provider: 'Google Analytics',
    providerDomain: 'google-analytics.com',
    description: 'Used to throttle request rate.',
    purpose: 'Analytics',
    category: 'analytics',
    duration: '1 minute',
    isThirdParty: true,
    riskLevel: 'LOW',
    detectionPatterns: {
      exact: ['_gat'],
      prefix: ['_gat_'],
    },
  },
  {
    cookieName: '_fbp',
    provider: 'Meta',
    providerDomain: 'facebook.com',
    description: 'Used by Meta to deliver advertising products.',
    purpose: 'Advertising',
    category: 'marketing',
    duration: '3 months',
    isThirdParty: true,
    privacyPolicyUrl: 'https://www.facebook.com/privacy/policy/',
    riskLevel: 'HIGH',
    detectionPatterns: {
      exact: ['_fbp'],
      scriptSources: ['connect.facebook.net'],
      networkEndpoints: ['facebook.com/tr'],
    },
  },
  {
    cookieName: 'fr',
    provider: 'Meta',
    providerDomain: 'facebook.com',
    description: 'Used by Meta for advertising and measurement.',
    purpose: 'Advertising',
    category: 'marketing',
    duration: '3 months',
    isThirdParty: true,
    riskLevel: 'HIGH',
    detectionPatterns: {
      exact: ['fr'],
      providerDomains: ['facebook.com'],
    },
  },
  {
    cookieName: 'IDE',
    provider: 'Google DoubleClick',
    providerDomain: 'doubleclick.net',
    description: 'Used by Google DoubleClick to register and report user actions for advertising.',
    purpose: 'Advertising',
    category: 'marketing',
    duration: '1 year',
    isThirdParty: true,
    riskLevel: 'HIGH',
    detectionPatterns: {
      exact: ['IDE'],
      providerDomains: ['doubleclick.net'],
    },
  },
  {
    cookieName: '__cf_bm',
    provider: 'Cloudflare',
    providerDomain: 'cloudflare.com',
    description: 'Cloudflare bot management cookie used to distinguish humans from bots.',
    purpose: 'Security',
    category: 'strictly_necessary',
    duration: '30 minutes',
    isThirdParty: true,
    riskLevel: 'LOW',
    detectionPatterns: {
      exact: ['__cf_bm'],
      prefix: ['__cf'],
      providerDomains: ['cloudflare.com'],
    },
  },
  {
    cookieName: 'NID',
    provider: 'Google',
    providerDomain: 'google.com',
    description: 'Registers a unique ID to store user preferences and other information.',
    purpose: 'Preferences',
    category: 'functional',
    duration: '6 months',
    isThirdParty: true,
    riskLevel: 'MEDIUM',
    detectionPatterns: {
      exact: ['NID'],
      providerDomains: ['google.com'],
    },
  },
  {
    cookieName: 'CONSENT',
    provider: 'YouTube',
    providerDomain: 'youtube.com',
    description: 'Stores user consent state for YouTube embedded content.',
    purpose: 'Consent storage',
    category: 'functional',
    duration: '2 years',
    isThirdParty: true,
    riskLevel: 'LOW',
    detectionPatterns: {
      exact: ['CONSENT'],
      providerDomains: ['youtube.com', 'youtube-nocookie.com'],
    },
  },
  {
    cookieName: '_hjSessionUser',
    provider: 'Hotjar',
    providerDomain: 'hotjar.com',
    description: 'Hotjar cookie that ensures data from subsequent visits are attributed to the same user.',
    purpose: 'Analytics',
    category: 'analytics',
    duration: '1 year',
    isThirdParty: true,
    riskLevel: 'MEDIUM',
    detectionPatterns: {
      prefix: ['_hj'],
      scriptSources: ['hotjar.com'],
    },
  },
  {
    cookieName: 'li_sugr',
    provider: 'LinkedIn',
    providerDomain: 'linkedin.com',
    description: 'Used by LinkedIn for browser identifier and advertising measurement.',
    purpose: 'Advertising',
    category: 'marketing',
    duration: '3 months',
    isThirdParty: true,
    riskLevel: 'HIGH',
    detectionPatterns: {
      prefix: ['li_'],
      scriptSources: ['snap.licdn.com'],
    },
  },
  {
    cookieName: 'cmp_consent',
    provider: 'CMP',
    description: 'Stores visitor consent choices for this consent management platform.',
    purpose: 'Consent storage',
    category: 'strictly_necessary',
    duration: '1 year',
    isThirdParty: false,
    riskLevel: 'LOW',
    detectionPatterns: {
      prefix: ['cmp_consent_'],
    },
  },
  {
    cookieName: 'cmp_visitor',
    provider: 'CMP',
    description: 'Anonymous visitor identifier used to link consent records.',
    purpose: 'Consent storage',
    category: 'strictly_necessary',
    duration: '1 year',
    isThirdParty: false,
    riskLevel: 'LOW',
    detectionPatterns: {
      prefix: ['cmp_visitor_'],
    },
  },
  {
    cookieName: 'cmp_lang',
    provider: 'CMP',
    description: 'Stores the visitor language preference for the consent banner.',
    purpose: 'Preferences',
    category: 'preferences',
    duration: '1 year',
    isThirdParty: false,
    riskLevel: 'LOW',
    detectionPatterns: {
      prefix: ['cmp_lang_'],
    },
  },
  {
    cookieName: '_clck',
    provider: 'Microsoft Clarity',
    providerDomain: 'clarity.ms',
    description: 'Persists the Clarity user ID and preferences.',
    purpose: 'Analytics',
    category: 'analytics',
    duration: '1 year',
    isThirdParty: true,
    privacyPolicyUrl: 'https://privacy.microsoft.com/privacystatement',
    riskLevel: 'MEDIUM',
    detectionPatterns: {
      exact: ['_clck'],
      prefix: ['_clsk'],
      scriptSources: ['clarity.ms'],
    },
  },
  {
    cookieName: '_gcl_au',
    provider: 'Google Ads',
    providerDomain: 'google.com',
    description: 'Used by Google Ads for conversion linker and ad measurement.',
    purpose: 'Advertising',
    category: 'marketing',
    duration: '3 months',
    isThirdParty: true,
    privacyPolicyUrl: 'https://policies.google.com/privacy',
    riskLevel: 'HIGH',
    detectionPatterns: {
      exact: ['_gcl_au'],
      scriptSources: ['googletagmanager.com', 'googleadservices.com'],
    },
  },
];
