import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import {
  assignCustomRoleSchema,
  createCustomRoleSchema,
  createDomainGroupSchema,
  dataResidencySchema,
  retentionPolicySchema,
  ssoConfigSchema,
  updateCustomRoleSchema,
  updateDomainGroupSchema,
  userDomainAccessSchema,
  whiteLabelSchema,
} from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { EnterpriseService } from './enterprise.service';
import { RetentionSchedulerService } from './retention-scheduler.service';

function meta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string | undefined,
  };
}

@Controller('enterprise')
export class EnterpriseController {
  constructor(
    private readonly enterpriseService: EnterpriseService,
    private readonly retentionScheduler: RetentionSchedulerService,
  ) {}

  @Get('settings')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  getSettings(@CurrentUserDecorator() user: CurrentUser) {
    return this.enterpriseService.getSettings(user).then(ok);
  }

  @Patch('white-label')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  updateWhiteLabel(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(whiteLabelSchema)) body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.enterpriseService.updateWhiteLabel(user, body, meta(req)).then(ok);
  }

  @Patch('sso')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  updateSso(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(ssoConfigSchema)) body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.enterpriseService.updateSsoConfig(user, body, meta(req)).then(ok);
  }

  @Patch('retention')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  updateRetention(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(retentionPolicySchema)) body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.enterpriseService.updateRetentionPolicy(user, body, meta(req)).then(ok);
  }

  @Patch('data-residency')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  updateDataResidency(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(dataResidencySchema)) body: { region?: string | null },
    @Req() req: Request,
  ) {
    return this.enterpriseService.updateDataResidency(user, body.region, meta(req)).then(ok);
  }

  @Post('retention/run')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  runRetention() {
    return this.retentionScheduler.runRetention().then(() =>
      ok({ message: 'Retention job completed' }),
    );
  }

  @Get('domain-groups')
  @RequirePermissions(PERMISSIONS.DOMAIN_MANAGE)
  listGroups(@CurrentUserDecorator() user: CurrentUser) {
    return this.enterpriseService.listDomainGroups(user).then(ok);
  }

  @Post('domain-groups')
  @RequirePermissions(PERMISSIONS.DOMAIN_MANAGE)
  createGroup(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(createDomainGroupSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.enterpriseService
      .createDomainGroup(user, body as Parameters<EnterpriseService['createDomainGroup']>[1], meta(req))
      .then(ok);
  }

  @Patch('domain-groups/:groupId')
  @RequirePermissions(PERMISSIONS.DOMAIN_MANAGE)
  updateGroup(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('groupId') groupId: string,
    @Body(new ZodValidationPipe(updateDomainGroupSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.enterpriseService
      .updateDomainGroup(user, groupId, body as Parameters<EnterpriseService['updateDomainGroup']>[2], meta(req))
      .then(ok);
  }

  @Delete('domain-groups/:groupId')
  @RequirePermissions(PERMISSIONS.DOMAIN_MANAGE)
  deleteGroup(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('groupId') groupId: string,
    @Req() req: Request,
  ) {
    return this.enterpriseService.deleteDomainGroup(user, groupId, meta(req)).then(ok);
  }

  @Post('domain-groups/:groupId/domains/:domainId')
  @RequirePermissions(PERMISSIONS.DOMAIN_MANAGE)
  addDomain(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('groupId') groupId: string,
    @Param('domainId') domainId: string,
    @Req() req: Request,
    @Query('role') role?: string,
  ) {
    return this.enterpriseService
      .addDomainToGroup(user, groupId, domainId, role, meta(req))
      .then(ok);
  }

  @Delete('domain-groups/:groupId/domains/:domainId')
  @RequirePermissions(PERMISSIONS.DOMAIN_MANAGE)
  removeDomain(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('groupId') groupId: string,
    @Param('domainId') domainId: string,
    @Req() req: Request,
  ) {
    return this.enterpriseService
      .removeDomainFromGroup(user, groupId, domainId, meta(req))
      .then(ok);
  }

  @Get('custom-roles')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  listCustomRoles(@CurrentUserDecorator() user: CurrentUser) {
    return this.enterpriseService.listCustomRoles(user).then(ok);
  }

  @Post('custom-roles')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  createCustomRole(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(createCustomRoleSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.enterpriseService
      .createCustomRole(user, body as Parameters<EnterpriseService['createCustomRole']>[1], meta(req))
      .then(ok);
  }

  @Patch('custom-roles/:roleId')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  updateCustomRole(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('roleId') roleId: string,
    @Body(new ZodValidationPipe(updateCustomRoleSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.enterpriseService
      .updateCustomRole(user, roleId, body as Parameters<EnterpriseService['updateCustomRole']>[2], meta(req))
      .then(ok);
  }

  @Delete('custom-roles/:roleId')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  deleteCustomRole(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('roleId') roleId: string,
    @Req() req: Request,
  ) {
    return this.enterpriseService.deleteCustomRole(user, roleId, meta(req)).then(ok);
  }

  @Post('custom-roles/assign')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  assignCustomRole(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(assignCustomRoleSchema)) body: { userId: string; customRoleId: string },
    @Req() req: Request,
  ) {
    return this.enterpriseService
      .assignCustomRole(user, body.userId, body.customRoleId, meta(req))
      .then(ok);
  }

  @Put('user-domain-access')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  setDomainAccess(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(userDomainAccessSchema)) body: {
      userId: string;
      domainId: string;
      permissions: string[];
    },
    @Req() req: Request,
  ) {
    return this.enterpriseService
      .setUserDomainAccess(user, body.userId, body.domainId, body.permissions, meta(req))
      .then(ok);
  }

  @Get('user-domain-access/:userId')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  listDomainAccess(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('userId') userId: string,
  ) {
    return this.enterpriseService.listUserDomainAccess(user, userId).then(ok);
  }
}
