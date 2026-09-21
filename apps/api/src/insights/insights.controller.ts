import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import {
  analyticsQuerySchema,
  createReportScheduleSchema,
} from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { InsightsService } from './insights.service';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('overview')
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  overview(@CurrentUserDecorator() user: CurrentUser) {
    return this.insightsService.getOverview(user).then(ok);
  }

  @Get('analytics/consent')
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  consentAnalytics(
    @CurrentUserDecorator() user: CurrentUser,
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: {
      domainId?: string;
      from?: string;
      to?: string;
    },
  ) {
    return this.insightsService.getConsentAnalytics(user, query).then(ok);
  }

  @Get('analytics/scans')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  scanAnalytics(
    @CurrentUserDecorator() user: CurrentUser,
    @Query('domainId') domainId?: string,
  ) {
    return this.insightsService.getScanAnalytics(user, domainId).then(ok);
  }

  @Get('notifications')
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  notifications(
    @CurrentUserDecorator() user: CurrentUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.insightsService
      .listNotifications(user, unreadOnly === 'true')
      .then(ok);
  }

  @Post('notifications/sync')
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  syncNotifications(@CurrentUserDecorator() user: CurrentUser) {
    return this.insightsService.syncNotifications(user).then(ok);
  }

  @Post('notifications/:id/read')
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  markRead(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.insightsService.markNotificationRead(user, id).then(ok);
  }

  @Post('notifications/read-all')
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  markAllRead(@CurrentUserDecorator() user: CurrentUser) {
    return this.insightsService.markAllNotificationsRead(user).then(ok);
  }

  @Get('reports/compliance')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  complianceReport(
    @CurrentUserDecorator() user: CurrentUser,
    @Query('domainId') domainId?: string,
  ) {
    return this.insightsService.generateComplianceReport(user, domainId).then(ok);
  }

  @Get('reports/compliance.xlsx')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  async complianceReportXlsx(
    @CurrentUserDecorator() user: CurrentUser,
    @Query('domainId') domainId: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.insightsService.generateComplianceReportXlsx(user, domainId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="compliance-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('reports/scan/:scanId')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  scanReport(@CurrentUserDecorator() user: CurrentUser, @Param('scanId') scanId: string) {
    return this.insightsService.generateScanReport(user, scanId).then(ok);
  }

  @Get('report-schedules')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  listSchedules(@CurrentUserDecorator() user: CurrentUser) {
    return this.insightsService.listReportSchedules(user).then(ok);
  }

  @Post('report-schedules')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  createSchedule(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(createReportScheduleSchema)) body: {
      domainId?: string;
      reportType: 'COMPLIANCE' | 'SCAN_SUMMARY' | 'CONSENT_EXPORT';
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
      deliveryEmail?: string;
      deliveryWebhook?: string;
      enabled?: boolean;
    },
  ) {
    return this.insightsService.createReportSchedule(user, body).then(ok);
  }

  @Delete('report-schedules/:scheduleId')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  deleteSchedule(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.insightsService.deleteReportSchedule(user, scheduleId).then(ok);
  }

  @Post('report-schedules/:scheduleId/run')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  runSchedule(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.insightsService.runReportSchedule(user, scheduleId).then(ok);
  }

  @Get('report-runs')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  listRuns(@CurrentUserDecorator() user: CurrentUser) {
    return this.insightsService.listReportRuns(user).then(ok);
  }
}
