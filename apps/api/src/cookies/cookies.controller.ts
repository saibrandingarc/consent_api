import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import { updateDomainCookieSchema } from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { CookiesService } from './cookies.service';

function meta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

@Controller()
export class CookiesController {
  constructor(private readonly cookiesService: CookiesService) {}

  @Get('cookie-definitions')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  listDefinitions(@CurrentUserDecorator() user: CurrentUser) {
    return this.cookiesService.listDefinitions(user).then(ok);
  }

  @Get('domains/:domainId/cookies')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  listDomainCookies(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.cookiesService.listDomainCookies(user, domainId).then(ok);
  }

  @Get('domains/:domainId/cookies/unknown')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  listUnknown(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.cookiesService.listUnknown(user, domainId).then(ok);
  }

  @Get('domains/:domainId/cookies/summary')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  getCategorySummary(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.cookiesService.getCategorySummary(user, domainId).then(ok);
  }

  @Patch('domains/:domainId/cookies/:cookieId')
  @RequirePermissions(PERMISSIONS.COOKIE_MANAGE)
  reviewCookie(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('cookieId') cookieId: string,
    @Body(new ZodValidationPipe(updateDomainCookieSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.cookiesService
      .reviewCookie(user, domainId, cookieId, body as Parameters<CookiesService['reviewCookie']>[3], meta(req))
      .then(ok);
  }

  @Get('domains/:domainId/scans/compare')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  compareScans(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Query('baseline') baselineScanId: string,
    @Query('target') targetScanId: string,
  ) {
    return this.cookiesService
      .compareScans(user, domainId, baselineScanId, targetScanId)
      .then(ok);
  }
}
