import { describe, expect, it } from 'vitest';
import { assertSameOrganization } from '../src/common/guards/tenant.guard';
import { ForbiddenException } from '@nestjs/common';
import type { CurrentUser } from '@cmp/types';

describe('Tenant isolation', () => {
  const userA: CurrentUser = {
    id: '1',
    email: 'a@test.com',
    firstName: 'A',
    lastName: 'User',
    emailVerified: true,
    organizationId: 'org-a',
    roles: ['org_admin'],
    permissions: ['user.manage'],
  };

  it('allows access within same organization', () => {
    expect(() => assertSameOrganization(userA, 'org-a')).not.toThrow();
  });

  it('blocks cross-tenant access', () => {
    expect(() => assertSameOrganization(userA, 'org-b')).toThrow(ForbiddenException);
  });

  it('allows super_admin cross-tenant access', () => {
    const superAdmin = { ...userA, roles: ['super_admin'] as const };
    expect(() => assertSameOrganization(superAdmin, 'org-b')).not.toThrow();
  });
});
