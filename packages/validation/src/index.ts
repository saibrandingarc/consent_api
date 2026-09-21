import { z } from 'zod';

/** Treats empty strings as undefined so optional fields can be left blank in forms. */
function optionalEmpty<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === '' || val === null ? undefined : val), schema);
}

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const auth0CallbackSchema = z.object({
  idToken: z.string().min(1),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(200),
  legalName: optionalEmpty(z.string().max(200).optional()),
  businessType: optionalEmpty(z.string().max(100).optional()),
  country: optionalEmpty(z.string().length(2).optional()),
  timezone: optionalEmpty(z.string().max(100).optional()),
  defaultLanguage: optionalEmpty(z.string().max(10).optional()),
  defaultRegulation: z.enum(['GDPR', 'CCPA', 'LGPD', 'PIPEDA', 'OTHER']).optional(),
  billingEmail: optionalEmpty(z.string().email().optional()),
  technicalContact: optionalEmpty(z.string().email().optional()),
  privacyContact: optionalEmpty(z.string().email().optional()),
  dpoDetails: optionalEmpty(z.string().max(500).optional()),
  storeConsentIpAddress: z.boolean().optional(),
  geoTargetingDisabled: z.boolean().optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const updateOnboardingSchema = z.object({
  step: z.number().int().min(1).max(10),
  complete: z.boolean().optional(),
  profile: createOrganizationSchema.partial().optional(),
});

const domainHostnameSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, 'Invalid domain format');

export const createDomainSchema = z.object({
  hostname: domainHostnameSchema,
  domainType: z.enum(['ROOT', 'SUBDOMAIN', 'STAGING', 'ALIAS']).default('ROOT'),
  isProduction: z.boolean().default(true),
  enabled: z.boolean().default(true),
  groupName: z.string().max(100).optional(),
  scanLimit: z.number().int().min(1).max(1000).default(10),
  scanFrequency: z.enum(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY']).default('MANUAL'),
  environment: z.string().max(50).default('production'),
  region: z.string().max(50).optional(),
  autoBlocking: z.boolean().default(true),
  debugMode: z.boolean().default(false),
});

export const updateDomainSchema = createDomainSchema.partial().omit({ hostname: true });

export const verifyDomainSchema = z.object({
  method: z.enum(['DNS_TXT', 'HTML_FILE', 'META_TAG', 'CMP_SCRIPT', 'MANUAL']),
});

export const sdkHeartbeatSchema = z.object({
  domainKey: z.string().min(1),
  hostname: z.string().min(1),
  scriptLoaded: z.boolean().optional(),
  consentEventDetected: z.boolean().optional(),
  autoBlockingEnabled: z.boolean().optional(),
  googleConsentModeDetected: z.boolean().optional(),
  googleConsentModeEnabled: z.boolean().optional(),
  googleConsentModeDefaultApplied: z.boolean().optional(),
  googleConsentModeUpdateApplied: z.boolean().optional(),
  googleConsentModeMode: z.enum(['basic', 'advanced']).optional(),
  duplicateScripts: z.number().int().optional(),
  jsErrors: z.array(z.string()).optional(),
  scriptLoadedFirst: z.boolean().optional(),
  defaultConsentApplied: z.boolean().optional(),
  preConsentViolations: z.number().int().min(0).optional(),
  integrationSource: z.enum(['wordpress', 'gtm', 'manual', 'shopify', 'other']).optional(),
});

export const blockingViolationReportSchema = z.object({
  domainKey: z.string().min(1),
  violations: z
    .array(
      z.object({
        url: z.string().max(2000),
        resourceType: z.string().max(50),
        category: z.string().max(100).optional(),
        vendor: z.string().max(200).optional(),
        rulePattern: z.string().max(500).optional(),
        pageUrl: z.string().max(2000).optional(),
      }),
    )
    .max(20),
});

export const privacyTriggerSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['floating_icon', 'footer_link', 'api_only']).default('floating_icon'),
  label: z.string().min(1).max(100).default('Privacy settings'),
  position: z.enum(['bottom-left', 'bottom-right']).default('bottom-right'),
  footerSelector: z.string().max(200).optional(),
});

export const sdkConsentSubmissionSchema = z.object({
  domainKey: z.string().min(1),
  visitorId: z.string().min(8).max(64),
  policyVersionId: z.string().uuid().nullable().optional(),
  configVersion: z.number().int().min(1),
  categories: z.record(z.boolean()),
  region: z.string().max(20).optional(),
  language: z.string().max(20).optional(),
  regulation: z.string().max(50).optional(),
  collectionMethod: z.enum([
    'banner_accept_all',
    'banner_reject_all',
    'banner_custom',
    'api',
    'withdrawal',
    'gpc',
    'consent_expired',
  ]),
  checksum: z.string().min(8).max(128),
  savedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().optional(),
  vendors: z.record(z.boolean()).optional(),
  authenticatedUserId: z.string().uuid().nullable().optional(),
  policySnapshot: z.record(z.unknown()).optional(),
});

export const invalidateConsentSchema = z.object({
  domainId: z.string().uuid(),
  visitorId: z.string().min(1).max(64),
  reason: z.string().max(500).optional(),
});

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleSlug: z.enum([
    'super_admin',
    'org_owner',
    'org_admin',
    'developer',
    'compliance_manager',
    'analyst',
    'viewer',
    'billing_admin',
  ]),
});

export const inviteUserSchema = z.object({
  email: z.string().email().max(255),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleSlug: z.enum([
    'org_admin',
    'developer',
    'compliance_manager',
    'analyst',
    'viewer',
    'billing_admin',
  ]),
});

export const permanentDeleteOrgSchema = z.object({
  confirmation: z.literal('DELETE'),
  organizationName: z.string().min(1),
});

export const loginHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const auditLogQuerySchema = z.object({
  module: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

export const consentRecordQuerySchema = z.object({
  domainId: z.string().uuid().optional(),
  consentId: z.string().uuid().optional(),
  visitorId: z.string().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  consentStatus: z.enum(['GRANTED', 'PARTIAL', 'REJECTED', 'WITHDRAWN']).optional(),
  collectionMethod: z.string().optional(),
  region: z.string().max(20).optional(),
  regulation: z.string().max(50).optional(),
  policyVersionId: z.string().uuid().optional(),
  format: z.enum(['csv', 'json', 'pdf']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

export const analyticsQuerySchema = z.object({
  domainId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const createReportScheduleSchema = z.object({
  domainId: z.string().uuid().optional(),
  reportType: z.enum(['COMPLIANCE', 'SCAN_SUMMARY', 'CONSENT_EXPORT']),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY']),
  deliveryEmail: z.string().email().optional(),
  deliveryWebhook: z.string().url().optional(),
  enabled: z.boolean().optional(),
});

const categoryMappingsSchema = z
  .object({
    scripts: z.array(z.string()).optional(),
    iframes: z.array(z.string()).optional(),
    pixels: z.array(z.string()).optional(),
    cookies: z.array(z.string()).optional(),
  })
  .optional();

export const createConsentCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
  description: z.string().max(1000).optional(),
  legalBasis: z.string().max(200).optional(),
  defaultState: z.enum(['ENABLED', 'DISABLED']).default('DISABLED'),
  required: z.boolean().default(false),
  enabled: z.boolean().default(true),
  externalSignals: z.record(z.unknown()).optional(),
  scriptMappings: categoryMappingsSchema,
  vendorPurposes: z.array(z.string()).optional(),
});

export const updateConsentCategorySchema = createConsentCategorySchema.partial().omit({ slug: true });

export const reorderConsentCategoriesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export const deleteConsentCategorySchema = z.object({
  remapToCategoryId: z.string().uuid().optional(),
});

const optionalUrlField = z.union([z.literal(''), z.string().url()]).optional();

export const bannerLayoutSchema = z.enum([
  'bottom_bar',
  'top_bar',
  'center_modal',
  'corner_popup',
  'fullscreen',
  'side_panel',
  'compact',
  'multi_step_modal',
]);

export const bannerBehaviorSchema = z.object({
  displayOnFirstVisit: z.boolean().default(true),
  displayAfterConsentExpires: z.boolean().default(true),
  displayWhenPolicyChanges: z.boolean().default(true),
  showOnPages: z.array(z.string()).default([]),
  excludePages: z.array(z.string()).default([]),
  displayDelayMs: z.number().int().min(0).max(60000).default(0),
  displayAfterScrollPercent: z.number().int().min(0).max(100).default(0),
  displayAfterInteraction: z.boolean().default(false),
  blockInteractionUntilChoice: z.boolean().default(false),
  respectGlobalPrivacyControl: z.boolean().default(false),
  rememberChoice: z.boolean().default(true),
  consentExpirationDays: z.number().int().min(0).max(3650).default(365),
  allowClose: z.boolean().default(false),
  clearCookiesOnWithdrawal: z.boolean().optional(),
});

export const bannerThemeSchema = z.object({
  primaryColor: z.string().max(20).default('#2563eb'),
  backgroundColor: z.string().max(20).default('#ffffff'),
  textColor: z.string().max(20).default('#111827'),
  buttonTextColor: z.string().max(20).default('#ffffff'),
  buttonStyle: z.enum(['filled', 'outline', 'soft']).default('filled'),
  borderRadius: z.string().max(20).default('8px'),
  fontFamily: z.string().max(200).default('system-ui, -apple-system, Segoe UI, Roboto, sans-serif'),
  fontSize: z.string().max(20).default('16px'),
  spacing: z.string().max(20).default('1rem'),
  shadow: z.string().max(100).default('0 10px 30px rgba(0,0,0,.15)'),
  overlayOpacity: z.number().min(0).max(1).default(0.45),
  logoUrl: optionalUrlField,
  iconUrl: optionalUrlField,
  customCss: z.string().max(4000).optional(),
});

export const bannerTranslationEntrySchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  acceptButton: z.string().max(100).optional(),
  rejectButton: z.string().max(100).optional(),
  preferencesButton: z.string().max(100).optional(),
  saveButton: z.string().max(100).optional(),
  closeButton: z.string().max(100).optional(),
  legalNotice: z.string().max(1000).optional(),
  footerContent: z.string().max(1000).optional(),
  privacyPolicyUrl: optionalUrlField,
  cookiePolicyUrl: optionalUrlField,
  categoryDescriptions: z.record(z.string().max(500)).optional(),
  categoryNames: z.record(z.string().max(100)).optional(),
  vendorDescriptions: z.record(z.string().max(500)).optional(),
  privacyTrigger: z.object({ label: z.string().max(100).optional() }).optional(),
});

export const bannerContentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  contentFormat: z.enum(['plain', 'basic_html']).default('plain'),
  acceptButton: z.string().min(1).max(100),
  rejectButton: z.string().min(1).max(100),
  preferencesButton: z.string().min(1).max(100),
  saveButton: z.string().min(1).max(100).default('Save preferences'),
  closeButton: z.string().min(1).max(100).default('Close'),
  legalNotice: z.string().max(1000).optional(),
  footerContent: z.string().max(1000).optional(),
  privacyPolicyUrl: optionalUrlField,
  cookiePolicyUrl: optionalUrlField,
  categoryDescriptions: z.record(z.string().max(500)).optional(),
  vendorDescriptions: z.record(z.string().max(500)).optional(),
  translations: z.record(bannerTranslationEntrySchema).optional(),
  embedPlaceholders: z
    .record(
      z.object({
        title: z.string().max(200).optional(),
        description: z.string().max(500).optional(),
        allowLabel: z.string().max(100).optional(),
      }),
    )
    .optional(),
  layout: bannerLayoutSchema.default('bottom_bar'),
  behavior: bannerBehaviorSchema.optional(),
  theme: bannerThemeSchema.optional(),
  privacyTrigger: privacyTriggerSchema.optional(),
});

export const translationSuggestionSchema = z.object({
  targetLanguage: z.string().min(2).max(10),
  source: z
    .object({
      title: z.string().max(200).optional(),
      description: z.string().max(2000).optional(),
      acceptButton: z.string().max(100).optional(),
      rejectButton: z.string().max(100).optional(),
      preferencesButton: z.string().max(100).optional(),
      saveButton: z.string().max(100).optional(),
      closeButton: z.string().max(100).optional(),
      legalNotice: z.string().max(1000).optional(),
      footerContent: z.string().max(1000).optional(),
      privacyTrigger: z.object({ label: z.string().max(100).optional() }).optional(),
    })
    .optional(),
});

export const regionalRuleSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().max(100),
  priority: z.number().int().default(0),
  conditions: z.object({
    countries: z.array(z.string().length(2)).optional(),
    countryGroups: z.array(z.string().max(20)).optional(),
    regions: z.array(z.string().max(20)).optional(),
    languages: z.array(z.string().max(10)).optional(),
    regulations: z.array(z.string().max(20)).optional(),
  }),
  profileId: z.string().min(1).max(50),
  bannerOverrides: z.record(z.unknown()).optional(),
  categoryDefaults: z.record(z.enum(['ENABLED', 'DISABLED'])).optional(),
});

export const geoRegulationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  defaultProfileId: z.string().max(50).optional(),
  regionalRules: z.array(regionalRuleSchema).optional(),
});

export const googleConsentModeSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['basic', 'advanced']).default('advanced'),
  adsDataRedaction: z.boolean().optional(),
  urlPassthrough: z.boolean().optional(),
  waitForUpdate: z.number().int().min(0).max(5000).optional(),
  regionDefaults: z.record(z.record(z.enum(['granted', 'denied']))).optional(),
});

export const regulationConfigSchema = z.object({
  googleConsentMode: googleConsentModeSchema.optional(),
  geo: geoRegulationSettingsSchema.optional(),
  consentTemplateId: z.enum(['gdpr', 'us_state_laws', 'gdpr_and_us']).nullable().optional(),
});

export const updatePolicyVersionSchema = z.object({
  bannerContent: bannerContentSchema.partial().optional(),
  legalText: z.record(z.unknown()).optional(),
  regulationConfig: regulationConfigSchema.optional(),
  defaultConsentStates: z.record(z.unknown()).optional(),
  supportedLanguages: z.array(z.string().min(2).max(10)).optional(),
  changeSummary: z.string().max(500).optional(),
});

export const schedulePolicySchema = z.object({
  scheduledAt: z.string().datetime(),
  changeSummary: z.string().max(500).optional(),
});

export const publishPolicySchema = z.object({
  changeSummary: z.string().max(500).optional(),
});

export const triggerRenewalSchema = z.object({
  reason: z.enum([
    'policy_materially_changed',
    'new_vendor_added',
    'new_consent_purpose',
    'consent_expired',
    'regulation_changed',
    'admin_requested',
    'consent_before_date',
  ]),
  scope: z.enum(['all', 'selected']).default('all'),
  metadata: z.record(z.unknown()).optional(),
});

export const createDomainScanSchema = z.object({
  startUrl: z.string().url().max(2000),
  maxPages: z.number().int().min(1).max(1000).optional(),
  maxDepth: z.number().int().min(0).max(10).default(2),
  includePaths: z.array(z.string().max(200)).optional(),
  excludePaths: z.array(z.string().max(200)).optional(),
  timeoutMs: z.number().int().min(5000).max(120000).default(30000),
  jsRendering: z.boolean().default(true),
  deviceType: z.enum(['desktop', 'mobile']).default('desktop'),
});

export const updateDomainCookieSchema = z.object({
  provider: z.string().max(200).optional(),
  providerDomain: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  purpose: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  duration: z.string().max(100).optional(),
  dataCollected: z.string().max(500).optional(),
  isThirdParty: z.boolean().optional(),
  privacyPolicyUrl: z.union([z.literal(''), z.string().url()]).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  reviewStatus: z.enum(['APPROVED', 'REJECTED', 'PENDING', 'AUTO_MATCHED']).optional(),
});

export const API_KEY_SCOPES = [
  'domains:read',
  'domains:write',
  'consent:read',
  'scans:read',
  'scans:write',
  'cookies:read',
  'policies:read',
] as const;

export const WEBHOOK_EVENT_TYPES = [
  'scan.started',
  'scan.completed',
  'scan.failed',
  'cookie.discovered',
  'cookie.changed',
  'tracker.violation_detected',
  'consent.created',
  'consent.updated',
  'consent.withdrawn',
  'policy.published',
  'domain.verification_failed',
  'installation.issue_detected',
] as const;

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  environment: z.enum(['PRODUCTION', 'SANDBOX']).default('PRODUCTION'),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
  expiresAt: z.string().datetime().optional(),
});

export const createWebhookEndpointSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

export const updateWebhookEndpointSchema = z.object({
  url: z.string().url().max(2000).optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

export const developerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const permissionSlugSchema = z.enum([
  'organization.manage',
  'domain.manage',
  'banner.configure',
  'scan.run',
  'scan.view',
  'cookie.manage',
  'consent.view',
  'consent.export',
  'user.manage',
  'integration.manage',
  'billing.manage',
  'api_key.manage',
  'audit.view',
]);

export const whiteLabelSchema = z.object({
  logoUrl: z.string().url().max(2000).optional().nullable(),
  primaryColor: z.string().max(32).optional().nullable(),
  dashboardTitle: z.string().max(120).optional().nullable(),
  cmpBrandName: z.string().max(120).optional().nullable(),
  hidePlatformBranding: z.boolean().optional(),
  customScriptDomain: z.string().max(255).optional().nullable(),
  customCmpDomain: z.string().max(255).optional().nullable(),
  customEmailFrom: z.string().max(255).optional().nullable(),
});

export const ssoConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['oidc', 'saml']).optional().nullable(),
  connectionName: z.string().max(120).optional().nullable(),
  issuerUrl: z.string().url().max(2000).optional().nullable(),
  allowedEmailDomains: z.array(z.string().max(120)).optional(),
  mfaRequired: z.boolean().optional(),
});

export const retentionPolicySchema = z.object({
  consentRetentionDays: z.number().int().min(30).max(3650).optional().nullable(),
  consentDeletionEnabled: z.boolean().optional(),
  scanRetentionDays: z.number().int().min(30).max(3650).optional().nullable(),
  auditRetentionDays: z.number().int().min(30).max(3650).optional().nullable(),
});

export const dataResidencySchema = z.object({
  region: z.enum(['eu', 'us', 'apac', 'global']).optional().nullable(),
});

export const createDomainGroupSchema = z.object({
  name: z.string().min(1).max(120),
  shareConsent: z.boolean().optional(),
  parentDomainId: z.string().uuid().optional().nullable(),
  allowedHostnames: z.array(z.string().max(255)).optional(),
  domainIds: z.array(z.string().uuid()).optional(),
});

export const updateDomainGroupSchema = createDomainGroupSchema.partial();

export const createCustomRoleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  permissions: z.array(permissionSlugSchema).min(1),
});

export const updateCustomRoleSchema = createCustomRoleSchema.partial();

export const assignCustomRoleSchema = z.object({
  userId: z.string().uuid(),
  customRoleId: z.string().uuid(),
});

export const userDomainAccessSchema = z.object({
  userId: z.string().uuid(),
  domainId: z.string().uuid(),
  permissions: z.array(permissionSlugSchema).min(1),
});

export const consentGroupSyncSchema = z.object({
  domainKey: z.string().min(1),
  visitorId: z.string().min(1).max(200),
  groupId: z.string().uuid(),
});

export const aiBannerTextSchema = z.object({
  regulation: z.string().max(50).optional(),
  industry: z.string().max(120).optional(),
  tone: z.enum(['professional', 'friendly', 'formal']).optional(),
  language: z.string().max(20).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type CreateConsentCategoryInput = z.infer<typeof createConsentCategorySchema>;
export type CreateDomainScanInput = z.infer<typeof createDomainScanSchema>;
export type UpdateDomainCookieInput = z.infer<typeof updateDomainCookieSchema>;
export type UpdatePolicyVersionInput = z.infer<typeof updatePolicyVersionSchema>;
export type BannerContentInput = z.infer<typeof bannerContentSchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
export type ConsentRecordQueryInput = z.infer<typeof consentRecordQuerySchema>;
