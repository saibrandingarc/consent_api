export type RoleSlug =
  | 'super_admin'
  | 'org_owner'
  | 'org_admin'
  | 'developer'
  | 'compliance_manager'
  | 'analyst'
  | 'viewer'
  | 'billing_admin';

export type PermissionSlug =
  | 'organization.manage'
  | 'domain.manage'
  | 'banner.configure'
  | 'scan.run'
  | 'scan.view'
  | 'cookie.manage'
  | 'consent.view'
  | 'consent.export'
  | 'user.manage'
  | 'integration.manage'
  | 'billing.manage'
  | 'api_key.manage'
  | 'audit.view';

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  organizationId: string | null;
  roles: RoleSlug[];
  permissions: PermissionSlug[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Auth0TokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface ApiResponse<T> {
  ok: true;
  data: T;
  requestId?: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: string;
  module: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
}
