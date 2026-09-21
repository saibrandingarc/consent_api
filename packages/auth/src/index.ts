import type { PermissionSlug, RoleSlug } from '@cmp/types';

export const PERMISSIONS = {
  ORGANIZATION_MANAGE: 'organization.manage',
  DOMAIN_MANAGE: 'domain.manage',
  BANNER_CONFIGURE: 'banner.configure',
  SCAN_RUN: 'scan.run',
  SCAN_VIEW: 'scan.view',
  COOKIE_MANAGE: 'cookie.manage',
  CONSENT_VIEW: 'consent.view',
  CONSENT_EXPORT: 'consent.export',
  USER_MANAGE: 'user.manage',
  INTEGRATION_MANAGE: 'integration.manage',
  BILLING_MANAGE: 'billing.manage',
  API_KEY_MANAGE: 'api_key.manage',
  AUDIT_VIEW: 'audit.view',
} as const satisfies Record<string, PermissionSlug>;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_DEFINITIONS: Record<
  RoleSlug,
  { name: string; description: string; permissions: Permission[] }
> = {
  super_admin: {
    name: 'Super Administrator',
    description: 'Full platform access across all organizations',
    permissions: Object.values(PERMISSIONS),
  },
  org_owner: {
    name: 'Organization Owner',
    description: 'Full access within the organization',
    permissions: Object.values(PERMISSIONS),
  },
  org_admin: {
    name: 'Organization Administrator',
    description: 'Manage organization settings, users, and configurations',
    permissions: [
      PERMISSIONS.ORGANIZATION_MANAGE,
      PERMISSIONS.DOMAIN_MANAGE,
      PERMISSIONS.BANNER_CONFIGURE,
      PERMISSIONS.SCAN_RUN,
      PERMISSIONS.SCAN_VIEW,
      PERMISSIONS.COOKIE_MANAGE,
      PERMISSIONS.CONSENT_VIEW,
      PERMISSIONS.CONSENT_EXPORT,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.INTEGRATION_MANAGE,
      PERMISSIONS.API_KEY_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
  developer: {
    name: 'Developer',
    description: 'Manage domains, integrations, and API keys',
    permissions: [
      PERMISSIONS.DOMAIN_MANAGE,
      PERMISSIONS.BANNER_CONFIGURE,
      PERMISSIONS.SCAN_RUN,
      PERMISSIONS.SCAN_VIEW,
      PERMISSIONS.COOKIE_MANAGE,
      PERMISSIONS.INTEGRATION_MANAGE,
      PERMISSIONS.API_KEY_MANAGE,
    ],
  },
  compliance_manager: {
    name: 'Compliance Manager',
    description: 'Configure consent policies and review compliance data',
    permissions: [
      PERMISSIONS.BANNER_CONFIGURE,
      PERMISSIONS.SCAN_VIEW,
      PERMISSIONS.COOKIE_MANAGE,
      PERMISSIONS.CONSENT_VIEW,
      PERMISSIONS.CONSENT_EXPORT,
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
  analyst: {
    name: 'Analyst',
    description: 'View scans, consent logs, and reports',
    permissions: [
      PERMISSIONS.SCAN_VIEW,
      PERMISSIONS.CONSENT_VIEW,
      PERMISSIONS.CONSENT_EXPORT,
    ],
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to dashboards and reports',
    permissions: [PERMISSIONS.SCAN_VIEW, PERMISSIONS.CONSENT_VIEW],
  },
  billing_admin: {
    name: 'Billing Administrator',
    description: 'Manage billing and subscription settings',
    permissions: [PERMISSIONS.BILLING_MANAGE, PERMISSIONS.ORGANIZATION_MANAGE],
  },
};

export function hasPermission(
  granted: readonly string[],
  required: string | string[],
): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.some((p) => granted.includes(p));
}

export function hasAnyRole(granted: readonly string[], required: RoleSlug[]): boolean {
  return required.some((r) => granted.includes(r));
}

export function isAdminRole(roles: readonly string[]): boolean {
  return hasAnyRole(roles, ['super_admin', 'org_owner', 'org_admin']);
}

export {
  getAuth0ClientId,
  getAuth0ClientSecret,
  isAuth0Configured,
  isAuthUiEnabled,
  getAppBaseUrl,
  resolveAppBaseUrl,
  resolveAppBaseUrlFromHeaders,
  getAuth0ClientOptions,
  appBaseUrlMatchesHost,
  getRequestHost,
  AUTH0_CALLBACK_PATH,
  AUTH0_LOGIN_PATH,
  AUTH0_LOGOUT_PATH,
} from './auth0-env';

export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;
