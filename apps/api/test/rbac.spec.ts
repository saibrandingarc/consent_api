import { describe, expect, it } from 'vitest';
import { hasPermission, PERMISSIONS, ROLE_DEFINITIONS } from '@cmp/auth';

describe('Sprint 1 RBAC', () => {
  it('defines all 8 roles', () => {
    expect(Object.keys(ROLE_DEFINITIONS)).toHaveLength(8);
  });

  it('defines all 13 permissions', () => {
    expect(Object.values(PERMISSIONS)).toHaveLength(13);
  });

  it('compliance manager cannot manage users', () => {
    const perms = ROLE_DEFINITIONS.compliance_manager.permissions;
    expect(hasPermission(perms, PERMISSIONS.USER_MANAGE)).toBe(false);
    expect(hasPermission(perms, PERMISSIONS.AUDIT_VIEW)).toBe(true);
  });

  it('org_owner has full org permissions', () => {
    const perms = ROLE_DEFINITIONS.org_owner.permissions;
    expect(hasPermission(perms, PERMISSIONS.ORGANIZATION_MANAGE)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.BILLING_MANAGE)).toBe(true);
  });
});
