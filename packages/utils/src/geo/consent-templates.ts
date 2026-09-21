import { BANNER_TEXT_TEMPLATES, type BannerTextTemplate } from '../banner-templates';
import { DEFAULT_REGIONAL_RULES, type GeoRegulationSettings, type RegionalRule } from './regional-rules';

/** CookieYes-style consent law templates. */
export type ConsentTemplateId = 'gdpr' | 'us_state_laws' | 'gdpr_and_us';

export interface ConsentTemplateDefinition {
  id: ConsentTemplateId;
  label: string;
  description: string;
  geo: GeoRegulationSettings;
  bannerTextId: string;
  respectGlobalPrivacyControl: boolean;
}

const US_RULES: RegionalRule[] = [
  {
    id: 'us-ccpa',
    name: 'United States (California)',
    priority: 80,
    conditions: { countries: ['US'], regions: ['CA'] },
    profileId: 'ccpa',
  },
  {
    id: 'us-states',
    name: 'United States',
    priority: 70,
    conditions: { countryGroups: ['US'] },
    profileId: 'us_opt_out',
  },
];

const GDPR_RULES: RegionalRule[] = DEFAULT_REGIONAL_RULES.filter((rule) =>
  ['eu-gdpr', 'uk-gdpr'].includes(rule.id),
);

export const CONSENT_TEMPLATES: ConsentTemplateDefinition[] = [
  {
    id: 'gdpr',
    label: 'GDPR',
    description: 'Opt-in for EU/UK visitors; optional cookies blocked until consent.',
    geo: {
      enabled: true,
      defaultProfileId: 'generic_opt_in',
      regionalRules: GDPR_RULES,
    },
    bannerTextId: 'gdpr',
    respectGlobalPrivacyControl: true,
  },
  {
    id: 'us_state_laws',
    label: 'US State Laws',
    description:
      'The selected consent template supports CCPA/CPRA, VCDPA, CPA, CTDPA, and UCPA. US visitors see opt-out controls, including California Do Not Sell / Share.',
    geo: {
      enabled: true,
      defaultProfileId: 'us_opt_out',
      regionalRules: US_RULES,
    },
    bannerTextId: 'us_state_laws',
    respectGlobalPrivacyControl: true,
  },
  {
    id: 'gdpr_and_us',
    label: 'GDPR & US State Laws',
    description: 'Geo-aware: GDPR opt-in in EU/UK, CCPA/US opt-out in the United States.',
    geo: {
      enabled: true,
      defaultProfileId: 'generic_opt_in',
      regionalRules: DEFAULT_REGIONAL_RULES,
    },
    bannerTextId: 'gdpr_and_us',
    respectGlobalPrivacyControl: true,
  },
];

export function getConsentTemplate(id: ConsentTemplateId | string | null | undefined) {
  return CONSENT_TEMPLATES.find((item) => item.id === id) ?? null;
}

export function resolveConsentTemplateBannerText(
  template: ConsentTemplateDefinition,
): BannerTextTemplate | undefined {
  return BANNER_TEXT_TEMPLATES.find((item) => item.id === template.bannerTextId);
}
