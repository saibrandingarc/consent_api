import { Controller, Get } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Repositories } from '@cmp/database';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '@cmp/auth';
import { REPOS } from '../database/database.module';

@Controller('roles')
export class RolesController {
  constructor(@Inject(REPOS) private readonly repos: Repositories) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  async list() {
    const roles = await this.repos.users.listRoles();
    return ok(
      roles.map((r) => ({
        slug: r.slug,
        name: r.name,
        description: r.description,
        permissions: r.permissions.map((p) => p.permission.slug),
      })),
    );
  }
}
