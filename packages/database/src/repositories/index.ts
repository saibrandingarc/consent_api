import type { PrismaClient } from '@prisma/client';
import { UserRepository } from './user.repository';
import { OrganizationRepository } from './organization.repository';
import { AuditRepository } from './audit.repository';
import { AuthTokenRepository } from './auth-token.repository';

import { DomainRepository } from './domain.repository';
import {
  ConsentCategoryRepository,
  ConsentRenewalRepository,
  PolicyVersionRepository,
} from './consent.repository';
import { ConsentSubmissionRepository } from './consent-submission.repository';
import { ScanRepository } from './scan.repository';
import { CookieRepository } from './cookie.repository';
import { BlockingViolationRepository } from './blocking-violation.repository';
import { NotificationRepository } from './notification.repository';
import { ReportScheduleRepository } from './report-schedule.repository';
import { ApiKeyRepository } from './api-key.repository';
import { WebhookRepository } from './webhook.repository';
import { DomainGroupRepository } from './domain-group.repository';
import { EnterpriseRepository } from './enterprise.repository';
import { AiRepository } from './ai.repository';

export function createRepositories(prisma: PrismaClient) {
  return {
    users: new UserRepository(prisma),
    organizations: new OrganizationRepository(prisma),
    audit: new AuditRepository(prisma),
    authTokens: new AuthTokenRepository(prisma),
    domains: new DomainRepository(prisma),
    consentCategories: new ConsentCategoryRepository(prisma),
    policyVersions: new PolicyVersionRepository(prisma),
    consentRenewals: new ConsentRenewalRepository(prisma),
    consentSubmissions: new ConsentSubmissionRepository(prisma),
    scans: new ScanRepository(prisma),
    cookies: new CookieRepository(prisma),
    blockingViolations: new BlockingViolationRepository(prisma),
    notifications: new NotificationRepository(prisma),
    reportSchedules: new ReportScheduleRepository(prisma),
    apiKeys: new ApiKeyRepository(prisma),
    webhooks: new WebhookRepository(prisma),
    domainGroups: new DomainGroupRepository(prisma),
    enterprise: new EnterpriseRepository(prisma),
    ai: new AiRepository(prisma),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
