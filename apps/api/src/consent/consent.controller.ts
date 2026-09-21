import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import {
  createConsentCategorySchema,
  deleteConsentCategorySchema,
  publishPolicySchema,
  reorderConsentCategoriesSchema,
  schedulePolicySchema,
  triggerRenewalSchema,
  translationSuggestionSchema,
  updateConsentCategorySchema,
  updatePolicyVersionSchema,
} from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { ConsentService } from './consent.service';
import { TranslationService } from './translation.service';

@Controller('domains/:domainId/consent')
@RequirePermissions(PERMISSIONS.BANNER_CONFIGURE)
export class ConsentController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly translationService: TranslationService,
  ) {}

  @Get('categories')
  listCategories(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.consentService.listCategories(user, domainId).then(ok);
  }

  @Post('categories')
  createCategory(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Body(new ZodValidationPipe(createConsentCategorySchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.consentService
      .createCategory(user, domainId, body as Parameters<ConsentService['createCategory']>[2], meta(req))
      .then(ok);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('categoryId') categoryId: string,
    @Body(new ZodValidationPipe(updateConsentCategorySchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.consentService
      .updateCategory(
        user,
        domainId,
        categoryId,
        body as Parameters<ConsentService['updateCategory']>[3],
        meta(req),
      )
      .then(ok);
  }

  @Delete('categories/:categoryId')
  deleteCategory(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('categoryId') categoryId: string,
    @Body(new ZodValidationPipe(deleteConsentCategorySchema)) body: { remapToCategoryId?: string },
    @Req() req: Request,
  ) {
    return this.consentService
      .deleteCategory(user, domainId, categoryId, body.remapToCategoryId, meta(req))
      .then(() => ok({ deleted: true }));
  }

  @Post('categories/reorder')
  reorderCategories(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Body(new ZodValidationPipe(reorderConsentCategoriesSchema)) body: { orderedIds: string[] },
    @Req() req: Request,
  ) {
    return this.consentService
      .reorderCategories(user, domainId, body.orderedIds, meta(req))
      .then(ok);
  }

  @Get('policies')
  listPolicies(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.consentService.listPolicies(user, domainId).then(ok);
  }

  @Get('policies/draft')
  getDraftPolicy(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.consentService.getDraftPolicy(user, domainId).then(ok);
  }

  @Patch('policies/:policyId')
  updatePolicy(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('policyId') policyId: string,
    @Body(new ZodValidationPipe(updatePolicyVersionSchema)) body: unknown,
    @Req() req: Request,
  ) {
    return this.consentService
      .updateDraftPolicy(
        user,
        domainId,
        policyId,
        body as Parameters<ConsentService['updateDraftPolicy']>[3],
        meta(req),
      )
      .then(ok);
  }

  @Post('policies/:policyId/translation-suggestions')
  suggestTranslations(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('policyId') policyId: string,
    @Body(new ZodValidationPipe(translationSuggestionSchema))
    body: { targetLanguage: string; source?: Record<string, unknown> },
  ) {
    void user;
    void domainId;
    void policyId;
    return ok(
      this.translationService.suggest(body.targetLanguage, (body.source ?? {}) as Parameters<
        TranslationService['suggest']
      >[1]),
    );
  }

  @Post('policies/:policyId/publish')
  publishPolicy(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('policyId') policyId: string,
    @Body(new ZodValidationPipe(publishPolicySchema)) body: { changeSummary?: string },
    @Req() req: Request,
  ) {
    return this.consentService
      .publishPolicy(user, domainId, policyId, body.changeSummary, meta(req))
      .then(ok);
  }

  @Post('policies/:policyId/schedule')
  schedulePolicy(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('policyId') policyId: string,
    @Body(new ZodValidationPipe(schedulePolicySchema)) body: { scheduledAt: string; changeSummary?: string },
    @Req() req: Request,
  ) {
    return this.consentService
      .schedulePolicy(user, domainId, policyId, body.scheduledAt, body.changeSummary, meta(req))
      .then(ok);
  }

  @Post('policies/:policyId/archive')
  archivePolicy(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Param('policyId') policyId: string,
    @Req() req: Request,
  ) {
    return this.consentService.archivePolicy(user, domainId, policyId, meta(req)).then(ok);
  }

  @Get('renewals')
  listRenewals(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
  ) {
    return this.consentService.listRenewals(user, domainId).then(ok);
  }

  @Post('renewals')
  triggerRenewal(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('domainId') domainId: string,
    @Body(new ZodValidationPipe(triggerRenewalSchema))
    body: { reason: string; scope?: string; metadata?: Record<string, unknown> },
    @Req() req: Request,
  ) {
    return this.consentService
      .triggerRenewal(user, domainId, body.reason, body.scope ?? 'all', body.metadata, meta(req))
      .then(ok);
  }
}

function meta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string | undefined,
  };
}
