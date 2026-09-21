import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import { consentRecordQuerySchema, invalidateConsentSchema } from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { consentProofToCsv, generateConsentProofPdf } from './consent-pdf.util';
import { ConsentRecordsService } from './consent-records.service';

@Controller('consent-records')
export class ConsentRecordsController {
  constructor(private readonly consentRecordsService: ConsentRecordsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  list(
    @CurrentUserDecorator() user: CurrentUser,
    @Query(new ZodValidationPipe(consentRecordQuerySchema)) query: {
      domainId?: string;
      consentId?: string;
      visitorId?: string;
      from?: string;
      to?: string;
      consentStatus?: string;
      collectionMethod?: string;
      region?: string;
      regulation?: string;
      policyVersionId?: string;
      limit: number;
      cursor?: string;
    },
  ) {
    return this.consentRecordsService.list(user, query).then(ok);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  async export(
    @CurrentUserDecorator() user: CurrentUser,
    @Query(new ZodValidationPipe(consentRecordQuerySchema.omit({ limit: true, cursor: true })))
    query: {
      domainId?: string;
      consentId?: string;
      visitorId?: string;
      from?: string;
      to?: string;
      consentStatus?: string;
      collectionMethod?: string;
      region?: string;
      regulation?: string;
      policyVersionId?: string;
      format?: 'csv' | 'json';
    },
    @Res() res: Response,
  ) {
    const format = query.format ?? 'csv';
    const items = await this.consentRecordsService.exportRecords(user, query);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="consent-records-${new Date().toISOString().slice(0, 10)}.json"`,
      );
      res.send(JSON.stringify(items, null, 2));
      return;
    }

    const header =
      'consent_id,domain,visitor_id,status,event,collection_method,region,language,regulation,config_version,proof_hash,created_at,expires_at\n';
    const rows = items
      .map((item) =>
        [
          item.id,
          item.domainHostname,
          item.visitorId,
          item.consentStatus,
          item.eventType,
          item.collectionMethod,
          item.region ?? '',
          item.language ?? '',
          item.regulation ?? '',
          item.configVersion,
          item.proofHash,
          item.createdAt,
          item.expiresAt ?? '',
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="consent-records-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(header + rows);
  }

  @Post('invalidations')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  invalidate(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(invalidateConsentSchema))
    body: { domainId: string; visitorId: string; reason?: string },
    @Req() req: Request,
  ) {
    return this.consentRecordsService
      .invalidateVisitorConsent(user, body, meta(req))
      .then(ok);
  }

  @Get(':consentId')
  @RequirePermissions(PERMISSIONS.CONSENT_VIEW)
  getProof(@CurrentUserDecorator() user: CurrentUser, @Param('consentId') consentId: string) {
    return this.consentRecordsService.getProof(user, consentId).then(ok);
  }

  @Get(':consentId/export')
  @RequirePermissions(PERMISSIONS.CONSENT_EXPORT)
  async exportProof(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('consentId') consentId: string,
    @Query('format') format: 'json' | 'csv' | 'pdf' = 'json',
    @Res() res: Response,
  ) {
    const proof = await this.consentRecordsService.getProof(user, consentId);

    if (format === 'pdf') {
      const buffer = await generateConsentProofPdf(proof);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="consent-proof-${consentId}.pdf"`,
      );
      res.send(buffer);
      return;
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="consent-proof-${consentId}.csv"`,
      );
      res.send(consentProofToCsv(proof));
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="consent-proof-${consentId}.json"`,
    );
    res.send(JSON.stringify(proof, null, 2));
  }
}

function meta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string | undefined,
  };
}
