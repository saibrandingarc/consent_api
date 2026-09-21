import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Repositories } from '@cmp/database';
import type { CurrentUser } from '@cmp/types';
import { REPOS } from '../database/database.module';
import { assertSameOrganization } from '../common/guards/tenant.guard';
import {
  buildInstallationChecks,
  summarizeChecks,
  type SdkHeartbeatPayload,
} from '../domains/installation-checks';
import { EmailService } from '../email/email.service';
import { ConsentRecordsService } from '../consent-records/consent-records.service';
import { buildXmlSpreadsheet } from '../common/utils/spreadsheet';

function defaultFromTo(query: { from?: string; to?: string }) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 86_400_000);
  return { from, to };
}

function nextRunFromFrequency(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'DAILY':
      return new Date(now.getTime() + 86_400_000);
    case 'WEEKLY':
      return new Date(now.getTime() + 7 * 86_400_000);
    case 'MONTHLY':
      return new Date(now.getTime() + 30 * 86_400_000);
    case 'QUARTERLY':
      return new Date(now.getTime() + 90 * 86_400_000);
    default:
      return new Date(now.getTime() + 7 * 86_400_000);
  }
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    @Inject(REPOS) private readonly repos: Repositories,
    private readonly emailService: EmailService,
    private readonly consentRecordsService: ConsentRecordsService,
  ) {}

  async getOverview(user: CurrentUser) {
    const orgId = this.requireOrg(user);
    const domains = await this.repos.domains.listByOrganization(orgId);
    const active = domains.filter((d) => d.enabled && !d.deletedAt);
    const verified = active.filter((d) => d.verificationStatus === 'VERIFIED');

    let installationPass = 0;
    let installationWarning = 0;
    let installationFail = 0;
    let consentModePass = 0;
    let consentModeWarning = 0;
    const domainHealth: Array<{
      domainId: string;
      hostname: string;
      verificationStatus: string;
      installationStatus: string;
      sdkLastSeenAt: string | null;
      consentModeStatus: string;
      integrationSource: string | null;
    }> = [];

    for (const domain of active) {
      const published = await this.repos.policyVersions.findPublished(domain.id);
      const checks = buildInstallationChecks({
        domainKey: domain.domainKey,
        verificationStatus: domain.verificationStatus,
        autoBlocking: domain.autoBlocking,
        isProduction: domain.isProduction,
        environment: domain.environment,
        sdkLastSeenAt: domain.sdkLastSeenAt,
        sdkLastHeartbeat: (domain.sdkLastHeartbeat as SdkHeartbeatPayload | null) ?? null,
        hasPublishedPolicy: Boolean(published),
      });
      const installStatus = summarizeChecks(checks);
      if (installStatus === 'PASS') installationPass += 1;
      else if (installStatus === 'WARNING') installationWarning += 1;
      else installationFail += 1;

      const heartbeat = domain.sdkLastHeartbeat as SdkHeartbeatPayload | null;
      let gcmStatus = 'UNKNOWN';
      if (heartbeat?.googleConsentModeEnabled === false) gcmStatus = 'DISABLED';
      else if (heartbeat?.googleConsentModeDefaultApplied) gcmStatus = 'PASS';
      else if (domain.sdkLastSeenAt) gcmStatus = 'WARNING';
      if (gcmStatus === 'PASS') consentModePass += 1;
      else if (gcmStatus === 'WARNING') consentModeWarning += 1;

      domainHealth.push({
        domainId: domain.id,
        hostname: domain.hostname,
        verificationStatus: domain.verificationStatus,
        installationStatus: installStatus,
        sdkLastSeenAt: domain.sdkLastSeenAt?.toISOString() ?? null,
        consentModeStatus: gcmStatus,
        integrationSource: heartbeat?.integrationSource ?? null,
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const consentInteractions = await this.repos.consentSubmissions.countInRange(
      orgId,
      thirtyDaysAgo,
    );
    const expiringConsents = await this.repos.consentSubmissions.countExpiring(orgId, 30);
    const unknownCookies = await this.repos.cookies.countReviewQueue(orgId);
    const preConsentViolations = await this.repos.blockingViolations.countRecent(orgId, 7);

    const latestScan = await this.repos.scans.findLatestForOrganization(orgId);
    const unreadNotifications = await this.repos.notifications.countUnread(orgId);

    return {
      widgets: {
        activeDomains: active.length,
        verifiedDomains: verified.length,
        installationHealth: {
          pass: installationPass,
          warning: installationWarning,
          fail: installationFail,
        },
        consentInteractions30d: consentInteractions,
        expiringConsents30d: expiringConsents,
        unknownCookies,
        preConsentViolations7d: preConsentViolations,
        consentModeStatus: { pass: consentModePass, warning: consentModeWarning },
        unreadNotifications,
        lastScan: latestScan
          ? {
              id: latestScan.id,
              domainId: latestScan.domainId,
              status: latestScan.status,
              createdAt: latestScan.createdAt.toISOString(),
              pagesScanned: latestScan.pagesScanned,
            }
          : null,
      },
      domainHealth,
    };
  }

  async getConsentAnalytics(
    user: CurrentUser,
    query: { domainId?: string; from?: string; to?: string },
  ) {
    const orgId = this.requireOrg(user);
    if (query.domainId) await this.assertDomain(user, query.domainId);
    const { from, to } = defaultFromTo(query);

    const total = await this.repos.consentSubmissions.countInRange(
      orgId,
      from,
      to,
      query.domainId,
    );

    const byMethod = await this.repos.consentSubmissions.aggregateByField(
      orgId,
      'collectionMethod',
      from,
      to,
      query.domainId,
    );
    const byEvent = await this.repos.consentSubmissions.aggregateByField(
      orgId,
      'eventType',
      from,
      to,
      query.domainId,
    );
    const byRegion = await this.repos.consentSubmissions.aggregateByField(
      orgId,
      'region',
      from,
      to,
      query.domainId,
    );
    const byRegulation = await this.repos.consentSubmissions.aggregateByField(
      orgId,
      'regulation',
      from,
      to,
      query.domainId,
    );
    const byStatus = await this.repos.consentSubmissions.aggregateByField(
      orgId,
      'consentStatus',
      from,
      to,
      query.domainId,
    );

    const methodMap = Object.fromEntries(
      byMethod.map((row) => [row.collectionMethod, row._count._all]),
    );
    const acceptAll = methodMap.banner_accept_all ?? 0;
    const rejectAll = methodMap.banner_reject_all ?? 0;
    const custom = methodMap.banner_custom ?? 0;
    const withdrawal = methodMap.withdrawal ?? 0;
    const gpc = methodMap.gpc ?? 0;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totalInteractions: total,
      rates: {
        acceptAll: total ? acceptAll / total : 0,
        rejectAll: total ? rejectAll / total : 0,
        customized: total ? custom / total : 0,
        withdrawal: total ? withdrawal / total : 0,
        gpc: total ? gpc / total : 0,
      },
      byCollectionMethod: byMethod.map((r) => ({
        key: r.collectionMethod,
        count: r._count._all,
      })),
      byEventType: byEvent.map((r) => ({ key: r.eventType, count: r._count._all })),
      byRegion: byRegion
        .filter((r) => r.region)
        .map((r) => ({ key: r.region!, count: r._count._all })),
      byRegulation: byRegulation
        .filter((r) => r.regulation)
        .map((r) => ({ key: r.regulation!, count: r._count._all })),
      byConsentStatus: byStatus.map((r) => ({
        key: r.consentStatus,
        count: r._count._all,
      })),
    };
  }

  async getScanAnalytics(user: CurrentUser, domainId?: string) {
    const orgId = this.requireOrg(user);
    if (domainId) await this.assertDomain(user, domainId);
    return this.repos.scans.aggregateForOrganization(orgId, domainId);
  }

  async listNotifications(user: CurrentUser, unreadOnly = false) {
    const orgId = this.requireOrg(user);
    const items = await this.repos.notifications.list(orgId, unreadOnly);
    return items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      severity: n.severity,
      domainId: n.domainId,
      domainHostname: n.domain?.hostname ?? null,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async markNotificationRead(user: CurrentUser, id: string) {
    const orgId = this.requireOrg(user);
    await this.repos.notifications.markRead(orgId, id);
    return { ok: true };
  }

  async markAllNotificationsRead(user: CurrentUser) {
    const orgId = this.requireOrg(user);
    await this.repos.notifications.markAllRead(orgId);
    return { ok: true };
  }

  async syncNotifications(user: CurrentUser) {
    const orgId = this.requireOrg(user);
    const since = new Date(Date.now() - 24 * 86_400_000);
    const domains = await this.repos.domains.listByOrganization(orgId);
    let created = 0;

    for (const domain of domains.filter((d) => d.enabled && !d.deletedAt)) {
      if (
        domain.isProduction &&
        domain.verificationStatus !== 'VERIFIED' &&
        !(await this.repos.notifications.findRecentDuplicate(
          orgId,
          'domain_not_verified',
          domain.id,
          since,
        ))
      ) {
        await this.repos.notifications.create({
          organizationId: orgId,
          domainId: domain.id,
          type: 'domain_not_verified',
          title: 'Domain not verified',
          message: `${domain.hostname} is not verified for production use.`,
          severity: 'WARNING',
        });
        created += 1;
      }

      if (
        !domain.sdkLastSeenAt &&
        !(await this.repos.notifications.findRecentDuplicate(
          orgId,
          'cmp_script_missing',
          domain.id,
          since,
        ))
      ) {
        await this.repos.notifications.create({
          organizationId: orgId,
          domainId: domain.id,
          type: 'cmp_script_missing',
          title: 'CMP script not detected',
          message: `No SDK heartbeat received for ${domain.hostname}.`,
          severity: 'ERROR',
        });
        created += 1;
      }

      const scans = await this.repos.scans.listByDomain(domain.id, 1);
      const latest = scans[0];
      if (
        latest?.status === 'FAILED' &&
        !(await this.repos.notifications.findRecentDuplicate(
          orgId,
          'scan_failed',
          domain.id,
          since,
        ))
      ) {
        await this.repos.notifications.create({
          organizationId: orgId,
          domainId: domain.id,
          type: 'scan_failed',
          title: 'Website scan failed',
          message: `Latest scan for ${domain.hostname} failed.`,
          severity: 'WARNING',
        });
        created += 1;
      }

      const published = await this.repos.policyVersions.findPublished(domain.id);
      if (
        published?.requiresRenewal &&
        !(await this.repos.notifications.findRecentDuplicate(
          orgId,
          'policy_renewal_required',
          domain.id,
          since,
        ))
      ) {
        await this.repos.notifications.create({
          organizationId: orgId,
          domainId: domain.id,
          type: 'policy_renewal_required',
          title: 'Consent renewal required',
          message: `Published policy for ${domain.hostname} requires visitor renewal.`,
          severity: 'WARNING',
        });
        created += 1;
      }
    }

    return { created };
  }

  async generateComplianceReport(user: CurrentUser, domainId?: string) {
    const orgId = this.requireOrg(user);
    const domains = domainId
      ? [await this.assertDomain(user, domainId)]
      : await this.repos.domains.listByOrganization(orgId);

    const sections = [];
    for (const domain of domains.filter((d) => d.enabled && !d.deletedAt)) {
      const published = await this.repos.policyVersions.findPublished(domain.id);
      const checks = buildInstallationChecks({
        domainKey: domain.domainKey,
        verificationStatus: domain.verificationStatus,
        autoBlocking: domain.autoBlocking,
        isProduction: domain.isProduction,
        environment: domain.environment,
        sdkLastSeenAt: domain.sdkLastSeenAt,
        sdkLastHeartbeat: (domain.sdkLastHeartbeat as SdkHeartbeatPayload | null) ?? null,
        hasPublishedPolicy: Boolean(published),
      });
      sections.push({
        domainId: domain.id,
        hostname: domain.hostname,
        overallStatus: summarizeChecks(checks),
        verificationStatus: domain.verificationStatus,
        hasPublishedPolicy: Boolean(published),
        autoBlocking: domain.autoBlocking,
        checks,
        outstandingRisks: checks.filter((c) => c.status !== 'PASS').map((c) => ({
          id: c.id,
          label: c.label,
          status: c.status,
          message: c.message,
        })),
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      organizationId: orgId,
      domainCount: sections.length,
      sections,
    };
  }

  async generateComplianceReportXlsx(user: CurrentUser, domainId?: string): Promise<Buffer> {
    const report = await this.generateComplianceReport(user, domainId);
    const headers = [
      'Domain',
      'Hostname',
      'Overall Status',
      'Verification',
      'Published Policy',
      'Auto Blocking',
      'Outstanding Risks',
    ];
    const rows = report.sections.map((section) => ({
      cells: [
        section.domainId,
        section.hostname,
        section.overallStatus,
        section.verificationStatus,
        section.hasPublishedPolicy ? 'Yes' : 'No',
        section.autoBlocking ? 'Yes' : 'No',
        section.outstandingRisks.map((risk) => `${risk.label} (${risk.status})`).join('; '),
      ],
    }));
    return buildXmlSpreadsheet('Compliance', headers, rows);
  }

  async generateScanReport(user: CurrentUser, scanId: string) {
    const orgId = this.requireOrg(user);
    const scan = await this.repos.scans.findById(scanId);
    if (!scan || scan.organizationId !== orgId) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan not found' });
    }

    const findings = scan.findings ?? [];
    const byType = findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.findingType] = (acc[f.findingType] ?? 0) + 1;
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      scan: {
        id: scan.id,
        domainId: scan.domainId,
        status: scan.status,
        startUrl: scan.startUrl,
        pagesScanned: scan.pagesScanned,
        createdAt: scan.createdAt.toISOString(),
        completedAt: scan.completedAt?.toISOString() ?? null,
      },
      summary: {
        totalFindings: findings.length,
        byType,
        pagesScanned: scan.pages?.length ?? scan.pagesScanned ?? 0,
      },
      pages: scan.pages?.map((p) => ({
        url: p.url,
        status: p.status,
        scannedAt: p.scannedAt.toISOString(),
      })),
      recommendations: this.scanRecommendations(scan.status, findings.length, byType),
    };
  }

  async listReportSchedules(user: CurrentUser) {
    const orgId = this.requireOrg(user);
    const schedules = await this.repos.reportSchedules.list(orgId);
    return schedules.map((s) => ({
      id: s.id,
      domainId: s.domainId,
      reportType: s.reportType,
      frequency: s.frequency,
      deliveryEmail: s.deliveryEmail,
      deliveryWebhook: s.deliveryWebhook,
      enabled: s.enabled,
      lastRunAt: s.lastRunAt?.toISOString() ?? null,
      nextRunAt: s.nextRunAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async createReportSchedule(
    user: CurrentUser,
    input: {
      domainId?: string;
      reportType: 'COMPLIANCE' | 'SCAN_SUMMARY' | 'CONSENT_EXPORT';
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
      deliveryEmail?: string;
      deliveryWebhook?: string;
      enabled?: boolean;
    },
  ) {
    const orgId = this.requireOrg(user);
    if (input.domainId) await this.assertDomain(user, input.domainId);
    if (!input.deliveryEmail && !input.deliveryWebhook) {
      throw new BadRequestException({
        code: 'DELIVERY_REQUIRED',
        message: 'Provide deliveryEmail or deliveryWebhook',
      });
    }

    const schedule = await this.repos.reportSchedules.create({
      organizationId: orgId,
      domainId: input.domainId ?? null,
      reportType: input.reportType,
      frequency: input.frequency,
      deliveryEmail: input.deliveryEmail ?? null,
      deliveryWebhook: input.deliveryWebhook ?? null,
      nextRunAt: nextRunFromFrequency(input.frequency),
    });

    return {
      id: schedule.id,
      reportType: schedule.reportType,
      frequency: schedule.frequency,
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    };
  }

  async deleteReportSchedule(user: CurrentUser, scheduleId: string) {
    const orgId = this.requireOrg(user);
    const schedule = await this.repos.reportSchedules.findById(scheduleId);
    if (!schedule || schedule.organizationId !== orgId) {
      throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Schedule not found' });
    }
    await this.repos.reportSchedules.delete(scheduleId);
    return { deleted: true };
  }

  async runReportSchedule(user: CurrentUser, scheduleId: string) {
    const orgId = this.requireOrg(user);
    const schedule = await this.repos.reportSchedules.findById(scheduleId);
    if (!schedule || schedule.organizationId !== orgId) {
      throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Schedule not found' });
    }

    return this.executeReportSchedule(schedule, user);
  }

  async runDueSchedules() {
    const due = await this.repos.reportSchedules.findDue();
    for (const schedule of due) {
      try {
        await this.executeReportSchedule(schedule, this.systemUser(schedule.organizationId));
      } catch (error) {
        this.logger.warn(
          `Scheduled report ${schedule.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async executeReportSchedule(
    schedule: NonNullable<Awaited<ReturnType<Repositories['reportSchedules']['findById']>>>,
    user: CurrentUser,
  ) {
    const orgId = schedule.organizationId;
    let summary: unknown;
    let deliveredTo: string | null = null;

    try {
      if (schedule.reportType === 'COMPLIANCE') {
        summary = await this.generateComplianceReport(user, schedule.domainId ?? undefined);
      } else if (schedule.reportType === 'SCAN_SUMMARY') {
        const latest = schedule.domainId
          ? (await this.repos.scans.listByDomain(schedule.domainId, 1))[0]
          : await this.repos.scans.findLatestForOrganization(orgId);
        if (!latest) {
          throw new BadRequestException({ code: 'NO_SCAN', message: 'No scan available' });
        }
        summary = await this.generateScanReport(user, latest.id);
      } else {
        const records = await this.consentRecordsService.exportRecords(user, {
          domainId: schedule.domainId ?? undefined,
        });
        summary = {
          recordCount: records.length,
          records,
          csv: this.consentRecordsToCsv(records),
        };
      }

      if (schedule.deliveryEmail) {
        await this.emailService.sendScheduledReport(
          schedule.deliveryEmail,
          schedule.reportType,
          summary,
        );
        deliveredTo = schedule.deliveryEmail;
      }

      if (schedule.deliveryWebhook) {
        const response = await fetch(schedule.deliveryWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportType: schedule.reportType,
            scheduleId: schedule.id,
            organizationId: orgId,
            domainId: schedule.domainId,
            generatedAt: new Date().toISOString(),
            summary,
          }),
        });
        if (!response.ok) {
          throw new BadRequestException({
            code: 'WEBHOOK_DELIVERY_FAILED',
            message: `Webhook returned ${response.status}`,
          });
        }
        deliveredTo = deliveredTo
          ? `${deliveredTo}, ${schedule.deliveryWebhook}`
          : schedule.deliveryWebhook;
      }

      await this.repos.reportSchedules.update(schedule.id, {
        lastRunAt: new Date(),
        nextRunAt: nextRunFromFrequency(schedule.frequency),
      });

      await this.repos.reportSchedules.createRun({
        organizationId: orgId,
        scheduleId: schedule.id,
        reportType: schedule.reportType,
        status: 'COMPLETED',
        resultSummary: JSON.parse(JSON.stringify(summary)),
        deliveredTo,
      });

      return { ok: true, deliveredTo };
    } catch (error) {
      await this.repos.reportSchedules.createRun({
        organizationId: orgId,
        scheduleId: schedule.id,
        reportType: schedule.reportType,
        status: 'FAILED',
        resultSummary: { error: String(error) },
      });
      throw error;
    }
  }

  async listReportRuns(user: CurrentUser) {
    const orgId = this.requireOrg(user);
    const runs = await this.repos.reportSchedules.listRuns(orgId);
    return runs.map((r) => ({
      id: r.id,
      scheduleId: r.scheduleId,
      reportType: r.reportType,
      status: r.status,
      deliveredTo: r.deliveredTo,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private scanRecommendations(
    status: string,
    findingCount: number,
    byType: Record<string, number>,
  ) {
    const tips: string[] = [];
    if (status === 'FAILED') tips.push('Re-run the scan and verify the start URL is reachable.');
    if (findingCount === 0) tips.push('No cookies or trackers detected — confirm JS rendering is enabled.');
    if ((byType.SCRIPT ?? 0) > 0 || (byType.NETWORK_REQUEST ?? 0) > 0) {
      tips.push('Review detected scripts and map them to consent categories.');
    }
    if ((byType.COOKIE ?? 0) > 5) {
      tips.push('High cookie count — review cookie repository and category mappings.');
    }
    return tips;
  }

  private requireOrg(user: CurrentUser) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }
    return user.organizationId;
  }

  private async assertDomain(user: CurrentUser, domainId: string) {
    const domain = await this.repos.domains.findById(domainId);
    if (!domain) {
      throw new NotFoundException({ code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' });
    }
    assertSameOrganization(user, domain.organizationId);
    return domain;
  }

  private systemUser(organizationId: string): CurrentUser {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'scheduler@internal.cmp',
      firstName: 'Report',
      lastName: 'Scheduler',
      emailVerified: true,
      organizationId,
      roles: ['org_admin'],
      permissions: [],
    };
  }

  private consentRecordsToCsv(
    records: Array<{
      id: string;
      domainHostname: string;
      visitorId: string;
      consentStatus: string;
      eventType: string;
      collectionMethod: string;
      region: string | null;
      language: string | null;
      regulation: string | null;
      configVersion: number;
      proofHash: string;
      createdAt: string;
      expiresAt: string | null;
    }>,
  ): string {
    const header =
      'consent_id,domain,visitor_id,status,event,collection_method,region,language,regulation,config_version,proof_hash,created_at,expires_at\n';
    const rows = records
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
    return header + rows;
  }
}
