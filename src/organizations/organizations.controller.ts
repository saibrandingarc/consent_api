import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import {
  createOrganizationSchema,
  permanentDeleteOrgSchema,
  updateOnboardingSchema,
  updateOrganizationSchema,
} from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(createOrganizationSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.organizationsService
      .create(user, body as Parameters<OrganizationsService['create']>[1], metaFrom(req))
      .then(ok);
  }

  @Get('me')
  getMine(@CurrentUserDecorator() user: CurrentUser) {
    return this.organizationsService.getMine(user).then(ok);
  }

  @Patch('me')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(updateOrganizationSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.organizationsService
      .update(user, body as Parameters<OrganizationsService['update']>[1], metaFrom(req))
      .then(ok);
  }

  @Delete('me')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  softDelete(@CurrentUserDecorator() user: CurrentUser, @Req() req: Request) {
    return this.organizationsService.softDelete(user, metaFrom(req)).then(ok);
  }

  @Get('me/onboarding')
  getOnboarding(@CurrentUserDecorator() user: CurrentUser) {
    return this.organizationsService.getOnboarding(user).then(ok);
  }

  @Patch('me/onboarding')
  updateOnboarding(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(updateOnboardingSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.organizationsService
      .updateOnboarding(user, body as Parameters<OrganizationsService['updateOnboarding']>[1], metaFrom(req))
      .then(ok);
  }

  @Delete('me/permanent')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  permanentDelete(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(permanentDeleteOrgSchema))
    body: { confirmation: 'DELETE'; organizationName: string },
    @Req() req: Request,
  ) {
    return this.organizationsService.permanentDelete(user, body, metaFrom(req)).then(ok);
  }
}

function metaFrom(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string | undefined,
  };
}
