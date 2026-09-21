import { describe, expect, it } from 'vitest';
import { hasPermission, PERMISSIONS, ROLE_DEFINITIONS } from '@cmp/auth';

describe('RBAC', () => {
  it('org_owner has all permissions', () => {
    const perms = ROLE_DEFINITIONS.org_owner.permissions;
    expect(hasPermission(perms, PERMISSIONS.ORGANIZATION_MANAGE)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.AUDIT_VIEW)).toBe(true);
  });

  it('viewer cannot manage users', () => {
    const perms = ROLE_DEFINITIONS.viewer.permissions;
    expect(hasPermission(perms, PERMISSIONS.USER_MANAGE)).toBe(false);
    expect(hasPermission(perms, PERMISSIONS.CONSENT_VIEW)).toBe(true);
  });
});
