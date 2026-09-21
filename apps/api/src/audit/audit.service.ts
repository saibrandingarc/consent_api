import { Inject, Injectable } from '@nestjs/common';
import type { Repositories } from '@cmp/database';
import { REPOS } from '../database/database.module';

export interface AuditLogInput {
  userId?: string | null;
  organizationId?: string | null;
  action: string;
  module: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditService {
  constructor(@Inject(REPOS) private readonly repos: Repositories) {}

  async log(input: AuditLogInput): Promise<unknown> {
    return this.repos.audit.create(input);
  }

  async list(
    organizationId: string,
    options: Parameters<Repositories['audit']['listByOrganization']>[1] = {},
  ): Promise<unknown[]> {
    return this.repos.audit.listByOrganization(organizationId, options);
  }

  async export(
    organizationId: string,
    options: Parameters<Repositories['audit']['exportByOrganization']>[1] = {},
  ): Promise<unknown[]> {
    return this.repos.audit.exportByOrganization(organizationId, options);
  }
}
