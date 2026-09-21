import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import { auditLogQuerySchema } from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  async list(
    @CurrentUserDecorator() user: CurrentUser,
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: {
      module?: string;
      action?: string;
      userId?: string;
      from?: string;
      to?: string;
      limit: number;
      cursor?: string;
    },
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }

    const logs = (await this.auditService.list(user.organizationId, {
      module: query.module,
      action: query.action,
      userId: query.userId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
      cursor: query.cursor,
    })) as Array<{ id: string }>;

    const hasMore = logs.length > query.limit;
    const items = hasMore ? logs.slice(0, query.limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return ok({ items, nextCursor });
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @CurrentUserDecorator() user: CurrentUser,
    @Query(new ZodValidationPipe(auditLogQuerySchema.omit({ limit: true, cursor: true })))
    query: {
      module?: string;
      action?: string;
      userId?: string;
      from?: string;
      to?: string;
    },
    @Res() res: Response,
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }

    const logs = (await this.auditService.export(user.organizationId, {
      module: query.module,
      action: query.action,
      userId: query.userId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    })) as Array<{
      id: string;
      createdAt: Date;
      action: string;
      module: string;
      ipAddress: string | null;
      requestId: string | null;
      user: { firstName: string; lastName: string; email: string } | null;
    }>;

    const header = 'id,timestamp,user,email,action,module,ip_address,request_id\n';
    const rows = logs
      .map((log) => {
        const u = log.user;
        return [
          log.id,
          log.createdAt.toISOString(),
          u ? `${u.firstName} ${u.lastName}` : '',
          u?.email ?? '',
          log.action,
          log.module,
          log.ipAddress ?? '',
          log.requestId ?? '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',');
      })
      .join('\n');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(header + rows);
  }
}
