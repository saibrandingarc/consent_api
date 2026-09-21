import type {
  BannerContent,
  CategorySnapshot,
  CmpConfig,
} from './types';

export interface PolicySnapshot {
  capturedAt: string;
  policyVersionId: string | null;
  policyVersionNumber: number | null;
  configVersion: number;
  region: string | null;
  language: string | null;
  categories: CategorySnapshot[];
  banner: BannerContentSnapshot | null;
}

export interface BannerContentSnapshot {
  title: string;
  description: string;
  acceptButton: string;
  rejectButton: string;
  preferencesButton: string;
  saveButton?: string;
  legalNotice?: string;
  footerContent?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  layout?: string;
  categoryDescriptions?: Record<string, string>;
  vendorDescriptions?: Record<string, string>;
}

export function buildPolicySnapshot(
  config: CmpConfig,
  region: string | null,
  language: string | null,
): PolicySnapshot {
  const banner = config.banner;
  return {
    capturedAt: new Date().toISOString(),
    policyVersionId: config.policyVersionId ?? null,
    policyVersionNumber: config.policyVersionNumber ?? null,
    configVersion: config.configVersion,
    region,
    language,
    categories: (config.categories ?? []).map((category) => ({
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
      required: category.required,
      enabled: category.enabled,
      defaultState: category.defaultState,
      vendorPurposes: category.vendorPurposes ?? null,
    })),
    banner: banner
      ? {
          title: banner.title,
          description: banner.description,
          acceptButton: banner.acceptButton,
          rejectButton: banner.rejectButton,
          preferencesButton: banner.preferencesButton,
          saveButton: banner.saveButton,
          legalNotice: banner.legalNotice,
          footerContent: banner.footerContent,
          privacyPolicyUrl: banner.privacyPolicyUrl,
          cookiePolicyUrl: banner.cookiePolicyUrl,
          layout: banner.layout,
          categoryDescriptions: banner.categoryDescriptions,
          vendorDescriptions: banner.vendorDescriptions,
        }
      : null,
  };
}

export function deriveVendorSelections(
  categories: CategorySnapshot[],
  consent: Record<string, boolean>,
): Record<string, boolean> {
  const vendors: Record<string, boolean> = {};
  for (const category of categories) {
    if (!category.enabled) continue;
    const categoryEnabled = consent[category.slug] ?? false;
    for (const vendorKey of category.vendorPurposes ?? []) {
      vendors[vendorKey] = categoryEnabled;
    }
  }
  return vendors;
}
