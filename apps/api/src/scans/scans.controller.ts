import { Body, Controller, Get, Header, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import { createDomainScanSchema } from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { ScansService } from './scans.service';

function meta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

@Controller('domains/:domainId/scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Get()
  list(@CurrentUserDecorator() user: CurrentUser, @Param('domainId') domainId: string) {
    return this.scansService.list(user, domainId).then(ok);
  }

  @Get(':scanId')
  get(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('scanId') scanId: string,
  ) {
    return this.scansService.get(user, domainId, scanId).then(ok);
  }

  @Get(':scanId/export')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  @Header('Content-Type', 'text/csv')
  async exportPages(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('scanId') scanId: string,
    @Res() res: Response,
  ) {
    const { hostname, csv } = await this.scansService.exportPagesCsv(user, domainId, scanId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${hostname}-scan-${scanId}-pages.csv"`,
    );
    res.send(csv);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SCAN_RUN, PERMISSIONS.DOMAIN_MANAGE)
  start(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Body(new ZodValidationPipe(createDomainScanSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.scansService
      .start(user, domainId, body as Parameters<ScansService['start']>[2], meta(req))
      .then(ok);
  }

  @Post(':scanId/retry')
  @RequirePermissions(PERMISSIONS.SCAN_RUN, PERMISSIONS.DOMAIN_MANAGE)
  retry(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('scanId') scanId: string,
    @Req() req: Request,
  ) {
    return this.scansService.retryScan(user, domainId, scanId, meta(req)).then(ok);
  }

  @Post(':scanId/cancel')
  @RequirePermissions(PERMISSIONS.SCAN_RUN, PERMISSIONS.DOMAIN_MANAGE)
  cancel(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('scanId') scanId: string,
    @Req() req: Request,
  ) {
    return this.scansService.cancelScan(user, domainId, scanId, meta(req)).then(ok);
  }
}
