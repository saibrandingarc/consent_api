import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import { aiBannerTextSchema } from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { AiService } from './ai.service';

function meta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string | undefined,
  };
}

@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('domains/:domainId/ai/suggestions')
  @RequirePermissions(PERMISSIONS.COOKIE_MANAGE)
  listSuggestions(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Query('status') status?: string,
  ) {
    return this.aiService.listSuggestions(user, domainId, status).then(ok);
  }

  @Post('domains/:domainId/ai/cookies/:cookieId/classify')
  @RequirePermissions(PERMISSIONS.COOKIE_MANAGE)
  classifyCookie(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('cookieId') cookieId: string,
  ) {
    return this.aiService.classifyCookie(user, domainId, cookieId).then(ok);
  }

  @Post('domains/:domainId/ai/cookies/:cookieId/describe')
  @RequirePermissions(PERMISSIONS.COOKIE_MANAGE)
  describeCookie(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('cookieId') cookieId: string,
  ) {
    return this.aiService.describeCookie(user, domainId, cookieId).then(ok);
  }

  @Post('domains/:domainId/ai/compliance-recommendations')
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  complianceRecommendations(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.aiService.generateComplianceRecommendations(user, domainId).then(ok);
  }

  @Post('domains/:domainId/ai/banner-text')
  @RequirePermissions(PERMISSIONS.BANNER_CONFIGURE)
  bannerText(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Body(new ZodValidationPipe(aiBannerTextSchema)) body: {
      regulation?: string;
      industry?: string;
      tone?: string;
      language?: string;
    },
  ) {
    return this.aiService.generateBannerText(user, domainId, body).then(ok);
  }

  @Post('domains/:domainId/ai/misclassified-check')
  @RequirePermissions(PERMISSIONS.COOKIE_MANAGE)
  misclassifiedCheck(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.aiService.detectMisclassifiedNecessary(user, domainId).then(ok);
  }

  @Post('ai/suggestions/:suggestionId/approve')
  @RequirePermissions(PERMISSIONS.COOKIE_MANAGE)
  approve(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('suggestionId') suggestionId: string,
    @Req() req: Request,
  ) {
    return this.aiService.approveSuggestion(user, suggestionId, meta(req)).then(ok);
  }

  @Post('ai/suggestions/:suggestionId/reject')
  @RequirePermissions(PERMISSIONS.COOKIE_MANAGE)
  reject(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('suggestionId') suggestionId: string,
    @Req() req: Request,
  ) {
    return this.aiService.rejectSuggestion(user, suggestionId, meta(req)).then(ok);
  }

  @Post('domains/:domainId/ai/regression/run')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  runRegression(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.aiService.runRegressionTests(user, domainId).then(ok);
  }

  @Get('domains/:domainId/ai/regression/runs')
  @RequirePermissions(PERMISSIONS.SCAN_VIEW)
  listRegression(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.aiService.listRegressionRuns(user, domainId).then(ok);
  }
}
