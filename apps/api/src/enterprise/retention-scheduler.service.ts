import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Repositories } from '@cmp/database';
import { REPOS } from '../database/database.module';

@Injectable()
export class RetentionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(RetentionSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(REPOS) private readonly repos: Repositories) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.runRetention();
    }, 3600_000);
  }

  async runRetention() {
    const orgs = await this.repos.organizations.listActive();
    for (const org of orgs) {
      const policy = (org.retentionPolicy as {
        consentDeletionEnabled?: boolean;
        consentRetentionDays?: number;
        auditRetentionDays?: number;
      } | null) ?? {};

      if (policy.consentDeletionEnabled && policy.consentRetentionDays) {
        const before = new Date(Date.now() - policy.consentRetentionDays * 86_400_000);
        const result = await this.repos.enterprise.deleteConsentSubmissionsBefore(org.id, before);
        if (result.count > 0) {
          this.logger.log(
            `Deleted ${result.count} consent records for org ${org.id} older than ${policy.consentRetentionDays} days`,
          );
        }
      }

      if (policy.auditRetentionDays) {
        const before = new Date(Date.now() - policy.auditRetentionDays * 86_400_000);
        const result = await this.repos.enterprise.deleteAuditLogsBefore(org.id, before);
        if (result.count > 0) {
          this.logger.log(
            `Deleted ${result.count} audit logs for org ${org.id} older than ${policy.auditRetentionDays} days`,
          );
        }
      }
    }
  }
}
