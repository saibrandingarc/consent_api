import { countryInGroups } from './country-groups';
import { normalizeRegionCode } from './region-codes';
import {
  getRegulationProfile,
  type RegulationProfile,
  type RegulationProfileBannerBehavior,
} from './regulation-profiles';

export interface RegionalRuleConditions {
  countries?: string[];
  countryGroups?: string[];
  regions?: string[];
  languages?: string[];
  regulations?: string[];
}

export interface RegionalRule {
  id: string;
  name: string;
  priority: number;
  conditions: RegionalRuleConditions;
  profileId: string;
  bannerOverrides?: Record<string, unknown>;
  categoryDefaults?: Record<string, 'ENABLED' | 'DISABLED'>;
}

export interface GeoRegulationSettings {
  enabled?: boolean;
  defaultProfileId?: string;
  regionalRules?: RegionalRule[];
}

export interface RuleMatchContext {
  country: string | null;
  region: string | null;
  language: string;
  regulation?: string | null;
}

export interface ResolvedGeoRegulation {
  profile: RegulationProfile;
  profileId: string;
  matchedRule: RegionalRule | null;
  regulation: string;
}

function matchesConditions(rule: RegionalRule, context: RuleMatchContext): boolean {
  const conditions = rule.conditions ?? {};

  if (conditions.countries?.length) {
    const country = context.country?.toUpperCase();
    if (!country || !conditions.countries.some((c) => c.toUpperCase() === country)) {
      return false;
    }
  }

  if (conditions.countryGroups?.length) {
    if (!countryInGroups(context.country, conditions.countryGroups)) return false;
  }

  if (conditions.regions?.length) {
    const region = normalizeRegionCode(context.region);
    if (!region) return false;
    const regionMatch = conditions.regions.some((r) => normalizeRegionCode(r) === region);
    if (!regionMatch) return false;
  }

  if (conditions.languages?.length) {
    const lang = context.language.toLowerCase();
    const match = conditions.languages.some(
      (l) => lang === l.toLowerCase() || lang.startsWith(`${l.toLowerCase()}-`),
    );
    if (!match) return false;
  }

  if (conditions.regulations?.length && context.regulation) {
    if (!conditions.regulations.some((r) => r.toUpperCase() === context.regulation!.toUpperCase())) {
      return false;
    }
  }

  return true;
}

export function resolveRegionalRule(
  context: RuleMatchContext,
  settings?: GeoRegulationSettings | null,
): { rule: RegionalRule | null; profileId: string } {
  if (!settings?.enabled) {
    return {
      rule: null,
      profileId: settings?.defaultProfileId ?? 'generic_opt_in',
    };
  }

  const rules = [...(settings.regionalRules ?? [])].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );

  const matched = rules.find((rule) => matchesConditions(rule, context));
  if (matched) {
    return { rule: matched, profileId: matched.profileId };
  }

  return {
    rule: null,
    profileId: settings.defaultProfileId ?? 'generic_opt_in',
  };
}

export function resolveGeoRegulation(
  context: RuleMatchContext,
  settings?: GeoRegulationSettings | null,
): ResolvedGeoRegulation {
  const { rule, profileId } = resolveRegionalRule(context, settings);
  const profile = getRegulationProfile(profileId);
  return {
    profile,
    profileId: profile.id,
    matchedRule: rule,
    regulation: profile.regulation,
  };
}

function deepMergeBehavior(
  base: RegulationProfileBannerBehavior | undefined,
  override: RegulationProfileBannerBehavior | undefined,
): RegulationProfileBannerBehavior {
  return { ...base, ...override };
}

export function applyRegulationProfile<T extends Record<string, unknown>>(
  banner: T | null | undefined,
  categories: Array<{ slug: string; defaultState?: string; enabled?: boolean }> | null | undefined,
  profile: RegulationProfile,
  rule?: RegionalRule | null,
): {
  banner: T | null;
  categories: Array<{ slug: string; defaultState?: string; enabled?: boolean }> | null;
} {
  const ruleBannerOverrides = (rule?.bannerOverrides ?? {}) as Record<string, unknown>;
  const profileBannerOverrides = profile.bannerOverrides ?? {};

  let mergedBanner: T | null = banner ? { ...banner } : null;
  if (mergedBanner) {
    const behavior = deepMergeBehavior(
      profile.bannerBehavior,
      (mergedBanner.behavior as RegulationProfileBannerBehavior | undefined) ?? undefined,
    );
    mergedBanner = {
      ...mergedBanner,
      ...profileBannerOverrides,
      ...ruleBannerOverrides,
      behavior: { ...(mergedBanner.behavior as object), ...behavior },
    } as T;

    if (profile.showDoNotSell) {
      const bannerFlags = mergedBanner as {
        showDoNotSell?: boolean;
        doNotSellLabel?: string;
        rejectButton?: string;
      };
      bannerFlags.showDoNotSell = true;
      bannerFlags.doNotSellLabel =
        bannerFlags.doNotSellLabel ?? 'Do Not Sell or Share My Personal Information';
      if (!bannerFlags.rejectButton) {
        bannerFlags.rejectButton = 'Do Not Sell or Share';
      }
    }
  }

  let mergedCategories = categories ? [...categories] : null;
  if (mergedCategories) {
    const ruleDefaults = rule?.categoryDefaults ?? {};
    mergedCategories = mergedCategories.map((category) => {
      if (category.slug === 'strictly_necessary') return category;
      const override = ruleDefaults[category.slug];
      const defaultState = override ?? profile.categoryDefaultState;
      return { ...category, defaultState };
    });
  }

  return { banner: mergedBanner, categories: mergedCategories };
}

/** Default regional rules for new policies. */
export const DEFAULT_REGIONAL_RULES: RegionalRule[] = [
  {
    id: 'eu-gdpr',
    name: 'European Union',
    priority: 100,
    conditions: { countryGroups: ['EU'] },
    profileId: 'gdpr',
  },
  {
    id: 'uk-gdpr',
    name: 'United Kingdom',
    priority: 90,
    conditions: { countryGroups: ['UK'] },
    profileId: 'uk_gdpr',
  },
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
  {
    id: 'brazil-lgpd',
    name: 'Brazil',
    priority: 60,
    conditions: { countryGroups: ['BR'] },
    profileId: 'lgpd',
  },
  {
    id: 'canada-pipeda',
    name: 'Canada',
    priority: 50,
    conditions: { countryGroups: ['CA'] },
    profileId: 'pipeda',
  },
];
