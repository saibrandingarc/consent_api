export type ConsentModel = 'opt_in' | 'opt_out';

export interface RegulationProfileBannerBehavior {
  respectGlobalPrivacyControl?: boolean;
  blockInteractionUntilChoice?: boolean;
  displayOnFirstVisit?: boolean;
  rememberChoice?: boolean;
  consentExpirationDays?: number;
}

export interface RegulationProfile {
  id: string;
  name: string;
  regulation: string;
  consentModel: ConsentModel;
  categoryDefaultState: 'ENABLED' | 'DISABLED';
  bannerBehavior?: RegulationProfileBannerBehavior;
  bannerOverrides?: {
    title?: string;
    description?: string;
    legalNotice?: string;
    rejectButton?: string;
    acceptButton?: string;
    preferencesButton?: string;
  };
  showDoNotSell?: boolean;
  description: string;
}

export const REGULATION_PROFILES: Record<string, RegulationProfile> = {
  gdpr: {
    id: 'gdpr',
    name: 'GDPR (EU)',
    regulation: 'GDPR',
    consentModel: 'opt_in',
    categoryDefaultState: 'DISABLED',
    bannerBehavior: {
      respectGlobalPrivacyControl: true,
      blockInteractionUntilChoice: false,
      displayOnFirstVisit: true,
      rememberChoice: true,
      consentExpirationDays: 365,
    },
    bannerOverrides: {
      rejectButton: 'Reject all',
      acceptButton: 'Accept all',
      preferencesButton: 'Manage preferences',
    },
    description: 'Explicit opt-in; optional categories disabled until consent.',
  },
  uk_gdpr: {
    id: 'uk_gdpr',
    name: 'UK GDPR',
    regulation: 'UK_GDPR',
    consentModel: 'opt_in',
    categoryDefaultState: 'DISABLED',
    bannerBehavior: {
      respectGlobalPrivacyControl: true,
      displayOnFirstVisit: true,
      rememberChoice: true,
      consentExpirationDays: 365,
    },
    description: 'UK GDPR-style explicit consent profile.',
  },
  ccpa: {
    id: 'ccpa',
    name: 'CCPA / CPRA (California)',
    regulation: 'CCPA',
    consentModel: 'opt_out',
    categoryDefaultState: 'ENABLED',
    bannerBehavior: {
      respectGlobalPrivacyControl: true,
      displayOnFirstVisit: true,
      rememberChoice: true,
      consentExpirationDays: 365,
    },
    showDoNotSell: true,
    bannerOverrides: {
      rejectButton: 'Do Not Sell or Share',
      acceptButton: 'Accept',
      preferencesButton: 'Privacy choices',
    },
    description: 'Opt-out model with Do Not Sell control and GPC support.',
  },
  us_opt_out: {
    id: 'us_opt_out',
    name: 'US state opt-out',
    regulation: 'US_STATE',
    consentModel: 'opt_out',
    categoryDefaultState: 'ENABLED',
    bannerBehavior: {
      respectGlobalPrivacyControl: true,
      displayOnFirstVisit: true,
    },
    showDoNotSell: true,
    description: 'Generic US state privacy opt-out profile.',
  },
  lgpd: {
    id: 'lgpd',
    name: 'LGPD (Brazil)',
    regulation: 'LGPD',
    consentModel: 'opt_in',
    categoryDefaultState: 'DISABLED',
    bannerBehavior: {
      displayOnFirstVisit: true,
      rememberChoice: true,
      consentExpirationDays: 365,
    },
    description: 'Brazil LGPD explicit consent profile.',
  },
  pipeda: {
    id: 'pipeda',
    name: 'PIPEDA (Canada)',
    regulation: 'PIPEDA',
    consentModel: 'opt_in',
    categoryDefaultState: 'DISABLED',
    bannerBehavior: {
      displayOnFirstVisit: true,
      rememberChoice: true,
    },
    description: 'Canadian PIPEDA-style consent profile.',
  },
  generic_opt_in: {
    id: 'generic_opt_in',
    name: 'Generic opt-in',
    regulation: 'OTHER',
    consentModel: 'opt_in',
    categoryDefaultState: 'DISABLED',
    bannerBehavior: { displayOnFirstVisit: true, rememberChoice: true },
    description: 'Default opt-in when no regional rule matches.',
  },
  generic_opt_out: {
    id: 'generic_opt_out',
    name: 'Generic opt-out',
    regulation: 'OTHER',
    consentModel: 'opt_out',
    categoryDefaultState: 'ENABLED',
    bannerBehavior: { displayOnFirstVisit: true, rememberChoice: true },
    description: 'Default opt-out when no regional rule matches.',
  },
};

export function getRegulationProfile(profileId: string | null | undefined): RegulationProfile {
  if (profileId && REGULATION_PROFILES[profileId]) {
    return REGULATION_PROFILES[profileId];
  }
  return REGULATION_PROFILES.generic_opt_in!;
}

export function listRegulationProfiles(): RegulationProfile[] {
  return Object.values(REGULATION_PROFILES);
}
