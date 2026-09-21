import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import {
  createDomainScanSchema,
  developerListQuerySchema,
} from '@cmp/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { ApiKeyGuard } from './guards/api-key.guard';
import { RequireApiKeyScope } from './decorators/api-key-scope.decorator';
import { ApiKeyContextDecorator } from './decorators/api-key-context.decorator';
import type { ApiKeyContext } from './guards/api-key.guard';
import { DeveloperService } from './developer.service';

@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('developer/v1')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  @Get('domains')
  @RequireApiKeyScope('domains:read')
  listDomains(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Query(new ZodValidationPipe(developerListQuerySchema))
    query: { page: number; limit: number },
  ) {
    return this.developerService.listDomains(ctx, query.page, query.limit).then(ok);
  }

  @Get('domains/:domainId')
  @RequireApiKeyScope('domains:read')
  getDomain(@ApiKeyContextDecorator() ctx: ApiKeyContext, @Param('domainId') domainId: string) {
    return this.developerService.getDomain(ctx, domainId).then(ok);
  }

  @Get('domains/:domainId/consent-records')
  @RequireApiKeyScope('consent:read')
  listConsentRecords(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Param('domainId') domainId: string,
    @Query() query: { limit?: string; cursor?: string; visitorId?: string; from?: string; to?: string },
  ) {
    const limit = Math.min(Number(query.limit ?? 25), 100);
    return this.developerService
      .listConsentRecords(ctx, domainId, {
        limit,
        cursor: query.cursor,
        visitorId: query.visitorId,
        from: query.from,
        to: query.to,
      })
      .then(ok);
  }

  @Get('domains/:domainId/scans')
  @RequireApiKeyScope('scans:read')
  listScans(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Param('domainId') domainId: string,
    @Query(new ZodValidationPipe(developerListQuerySchema))
    query: { page: number; limit: number },
  ) {
    return this.developerService.listScans(ctx, domainId, query.page, query.limit).then(ok);
  }

  @Get('domains/:domainId/scans/:scanId')
  @RequireApiKeyScope('scans:read')
  getScan(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Param('domainId') domainId: string,
    @Param('scanId') scanId: string,
  ) {
    return this.developerService.getScan(ctx, domainId, scanId).then(ok);
  }

  @Post('domains/:domainId/scans')
  @RequireApiKeyScope('scans:write')
  startScan(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Param('domainId') domainId: string,
    @Body(new ZodValidationPipe(createDomainScanSchema)) body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.developerService
      .startScan(ctx, domainId, body as Parameters<DeveloperService['startScan']>[2], idempotencyKey)
      .then((result) => {
        if (result && typeof result === 'object' && 'ok' in result) {
          return result;
        }
        return ok(result);
      });
  }

  @Get('domains/:domainId/cookies')
  @RequireApiKeyScope('cookies:read')
  listCookies(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Param('domainId') domainId: string,
    @Query(new ZodValidationPipe(developerListQuerySchema))
    query: { page: number; limit: number },
  ) {
    return this.developerService.listCookies(ctx, domainId, query.page, query.limit).then(ok);
  }

  @Get('domains/:domainId/policies')
  @RequireApiKeyScope('policies:read')
  listPolicies(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Param('domainId') domainId: string,
    @Query(new ZodValidationPipe(developerListQuerySchema))
    query: { page: number; limit: number },
  ) {
    return this.developerService.listPolicies(ctx, domainId, query.page, query.limit).then(ok);
  }

  @Get('domains/:domainId/installation-script')
  @RequireApiKeyScope('domains:read')
  getInstallScript(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Param('domainId') domainId: string,
  ) {
    return this.developerService.getInstallScript(ctx, domainId).then(ok);
  }

  @Post('domains/:domainId/validate-installation')
  @RequireApiKeyScope('domains:read')
  validateInstallation(
    @ApiKeyContextDecorator() ctx: ApiKeyContext,
    @Param('domainId') domainId: string,
  ) {
    return this.developerService.validateInstallation(ctx, domainId).then(ok);
  }
}
