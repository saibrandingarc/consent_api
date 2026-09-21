import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { CurrentUser } from '@cmp/types';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: CurrentUser;
      params: { userId?: string; id?: string };
      body: { userId?: string };
    }>();
    const user = request.user;
    if (!user?.organizationId) return true;

    const targetUserId = request.params.userId ?? request.body?.userId;
    if (!targetUserId) return true;

    return true;
  }
}

export function assertSameOrganization(
  actor: CurrentUser,
  targetOrganizationId: string | null | undefined,
) {
  if (!actor.organizationId || !targetOrganizationId) return;
  if (actor.organizationId !== targetOrganizationId && !actor.roles.includes('super_admin')) {
    throw new ForbiddenException({
      code: 'TENANT_ISOLATION',
      message: 'Cross-tenant access denied',
    });
  }
}
