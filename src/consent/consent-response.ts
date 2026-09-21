export interface ConsentCategoryResponse {
  id: string;
  domainId: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  legalBasis: string | null;
  defaultState: string;
  required: boolean;
  sortOrder: number;
  isSystem: boolean;
  enabled: boolean;
  externalSignals: unknown;
  scriptMappings: unknown;
  vendorPurposes: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyVersionResponse {
  id: string;
  domainId: string;
  organizationId: string;
  versionNumber: number;
  status: string;
  categoriesSnapshot: unknown;
  bannerContent: unknown;
  legalText: unknown;
  regulationConfig: unknown;
  defaultConsentStates: unknown;
  supportedLanguages: unknown;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  requiresRenewal: boolean;
  renewalReason: unknown;
  changeSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsentRenewalResponse {
  id: string;
  domainId: string;
  organizationId: string;
  policyVersionId: string | null;
  reason: string;
  scope: string;
  triggeredBy: string | null;
  metadata: unknown;
  createdAt: Date;
}

export function toCategoryResponse(category: {
  id: string;
  domainId: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  legalBasis: string | null;
  defaultState: string;
  required: boolean;
  sortOrder: number;
  isSystem: boolean;
  enabled: boolean;
  externalSignals: unknown;
  scriptMappings: unknown;
  vendorPurposes: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ConsentCategoryResponse {
  return {
    id: category.id,
    domainId: category.domainId,
    organizationId: category.organizationId,
    slug: category.slug,
    name: category.name,
    description: category.description,
    legalBasis: category.legalBasis,
    defaultState: category.defaultState,
    required: category.required,
    sortOrder: category.sortOrder,
    isSystem: category.isSystem,
    enabled: category.enabled,
    externalSignals: category.externalSignals,
    scriptMappings: category.scriptMappings,
    vendorPurposes: category.vendorPurposes,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export function toPolicyResponse(policy: {
  id: string;
  domainId: string;
  organizationId: string;
  versionNumber: number;
  status: string;
  categoriesSnapshot: unknown;
  bannerContent: unknown;
  legalText: unknown;
  regulationConfig: unknown;
  defaultConsentStates: unknown;
  supportedLanguages: unknown;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  requiresRenewal: boolean;
  renewalReason: unknown;
  changeSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PolicyVersionResponse {
  return {
    id: policy.id,
    domainId: policy.domainId,
    organizationId: policy.organizationId,
    versionNumber: policy.versionNumber,
    status: policy.status,
    categoriesSnapshot: policy.categoriesSnapshot,
    bannerContent: policy.bannerContent,
    legalText: policy.legalText,
    regulationConfig: policy.regulationConfig,
    defaultConsentStates: policy.defaultConsentStates,
    supportedLanguages: policy.supportedLanguages,
    scheduledAt: policy.scheduledAt,
    publishedAt: policy.publishedAt,
    archivedAt: policy.archivedAt,
    requiresRenewal: policy.requiresRenewal,
    renewalReason: policy.renewalReason,
    changeSummary: policy.changeSummary,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

export function snapshotCategories(
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    legalBasis: string | null;
    defaultState: string;
    required: boolean;
    sortOrder: number;
    isSystem: boolean;
    enabled: boolean;
    externalSignals: unknown;
    scriptMappings: unknown;
    vendorPurposes: unknown;
  }>,
) {
  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    legalBasis: category.legalBasis,
    defaultState: category.defaultState,
    required: category.required,
    sortOrder: category.sortOrder,
    isSystem: category.isSystem,
    enabled: category.enabled,
    externalSignals: category.externalSignals,
    scriptMappings: category.scriptMappings,
    vendorPurposes: category.vendorPurposes,
  }));
}
