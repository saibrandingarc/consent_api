import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Repositories } from '@cmp/database';
import type { CurrentUser } from '@cmp/types';
import type { CreateDomainScanInput } from '@cmp/validation';
import { REPOS } from '../database/database.module';
import { assertSameOrganization } from '../common/guards/tenant.guard';
import { AuditService } from '../audit/audit.service';
import type { AuditMeta } from '../organizations/organizations.service';
import { CookiesService } from '../cookies/cookies.service';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';
import { runWebsiteScan, ScanCancelledError } from './scanner/scanner.engine';
import { warmSharedBrowser } from './scanner/browser-pool';
import { buildStartUrl, getHostname } from './scanner/crawl.util';
import { countInventoryFromFindings } from '../cookies/scan-findings-ingest';
import { nextScanAtFromFrequency } from '../domains/domains.service';

export interface ScanSummaryResponse {
  id: string;
  domainId: string;
  status: string;
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  pagesScanned: number;
  progressPercent?: number;
  cookiesFound: number;
  trackersFound: number;
  errorMessage: string | null;
  progressMessage?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface ScanDetailResponse extends ScanSummaryResponse {
  includePaths: string[] | null;
  excludePaths: string[] | null;
  timeoutMs: number;
  jsRendering: boolean;
  deviceType: string;
  pages: Array<{
    id: string;
    url: string;
    canonicalUrl: string | null;
    status: string;
    depth: number;
    errorMessage: string | null;
    scannedAt: string;
  }>;
  findings: Array<{
    id: string;
    findingType: string;
    consentState: string;
    name: string;
    valueSample: string | null;
    cookieDomain: string | null;
    cookiePath: string | null;
    expiresAt: string | null;
    secure: boolean | null;
    httpOnly: boolean | null;
    sameSite: string | null;
    isThirdParty: boolean | null;
    pageUrl: string | null;
    technology: string | null;
    sourceUrl: string | null;
  }>;
}

@Injectable()
export class ScansService implements OnModuleInit {
  private readonly logger = new Logger(ScansService.name);
  private readonly activeScans = new Set<string>();
  private readonly cancelRequests = new Set<string>();

  constructor(
    @Inject(REPOS) private readonly repos: Repositories,
    private readonly auditService: AuditService,
    private readonly cookiesService: CookiesService,
    private readonly webhookDelivery: WebhookDeliveryService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Warm Chromium at boot so the first scan does not pay the cold-launch tax on Cloud Run.
    void warmSharedBrowser().catch((err) => {
      this.logger.warn(
        `Chromium warm-up deferred: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async list(user: CurrentUser, domainId: string): Promise<ScanSummaryResponse[]> {
    const domain = await this.getDomainForUser(user, domainId);
    const expiredIds = await this.repos.scans.expireStaleRunningScans(domain.id, 30 * 60 * 1000);
    for (const id of expiredIds) {
      this.cancelRequests.add(id);
      this.activeScans.delete(id);
    }
    const scans = await this.repos.scans.listByDomain(domain.id);
    const summaries = await Promise.all(
      scans.map(async (scan) => {
        if (scan.status !== 'RUNNING') {
          let summary = scan;
          if (
            scan.status === 'COMPLETED' &&
            scan.cookiesFound === 0 &&
            scan.trackersFound === 0
          ) {
            const stats = await this.repos.scans.countFindingStatsForScan(scan.id);
            if (stats.cookies > 0 || stats.trackers > 0) {
              summary = {
                ...scan,
                cookiesFound: stats.cookies,
                trackersFound: stats.trackers,
              };
            }
          }
          return this.toSummary(summary);
        }
        const live = await this.repos.scans.getLiveProgress(scan.id);
        return this.toSummary({
          ...scan,
          pagesScanned: Math.max(scan.pagesScanned, live.pagesScanned),
          cookiesFound: live.cookiesFound,
          trackersFound: live.trackersFound,
        });
      }),
    );
    return summaries;
  }

  async get(user: CurrentUser, domainId: string, scanId: string): Promise<ScanDetailResponse> {
    const domain = await this.getDomainForUser(user, domainId);
    const scan = await this.repos.scans.findById(scanId);
    if (!scan || scan.domainId !== domain.id) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan not found' });
    }
    return this.toDetail(scan);
  }

  async exportPagesCsv(user: CurrentUser, domainId: string, scanId: string) {
    const domain = await this.getDomainForUser(user, domainId);
    const scan = await this.repos.scans.findById(scanId);
    if (!scan || scan.domainId !== domain.id) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan not found' });
    }

    const header = 'url,status,depth,error_message\n';
    const rows = scan.pages
      .map((page) =>
        [page.url, page.status, page.depth, page.errorMessage ?? '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    return { hostname: domain.hostname, csv: header + rows };
  }

  async start(
    user: CurrentUser,
    domainId: string,
    input: CreateDomainScanInput,
    meta: AuditMeta,
  ): Promise<ScanSummaryResponse> {
    const domain = await this.getDomainForUser(user, domainId);
    const running = await this.repos.scans.countRunningForDomain(domain.id);
    if (running > 0) {
      throw new ConflictException({
        code: 'SCAN_ALREADY_RUNNING',
        message: 'A scan is already running for this domain',
      });
    }

    const maxPages = Math.min(input.maxPages ?? domain.scanLimit, domain.scanLimit);
    const startUrl = input.startUrl ?? buildStartUrl(domain.hostname);

    const scan = await this.repos.scans.create({
      domainId: domain.id,
      organizationId: domain.organizationId,
      startUrl,
      maxPages,
      maxDepth: input.maxDepth,
      includePaths: input.includePaths,
      excludePaths: input.excludePaths,
      timeoutMs: input.timeoutMs,
      jsRendering: input.jsRendering,
      deviceType: input.deviceType,
      createdByUserId: user.id,
    });

    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'scan.started',
      module: 'scanner',
      newValue: { scanId: scan.id, domainId: domain.id, startUrl },
      ...meta,
    });

    void this.processScan(scan.id).catch((error) => {
      this.logger.error(
        `Background scan ${scan.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    void this.webhookDelivery.emit(scan.organizationId, 'scan.started', {
      scanId: scan.id,
      domainId: domain.id,
      startUrl,
      status: scan.status,
    });
    return this.toSummary(scan);
  }

  async retryScan(
    user: CurrentUser,
    domainId: string,
    scanId: string,
    meta: AuditMeta,
  ): Promise<ScanSummaryResponse> {
    const domain = await this.getDomainForUser(user, domainId);
    const failedScan = await this.repos.scans.findById(scanId);
    if (!failedScan || failedScan.domainId !== domain.id) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan not found' });
    }
    if (failedScan.status !== 'FAILED' && failedScan.status !== 'CANCELLED') {
      throw new BadRequestException({
        code: 'SCAN_NOT_RETRYABLE',
        message: 'Only failed or cancelled scans can be retried',
      });
    }

    const running = await this.repos.scans.countRunningForDomain(domain.id);
    if (running > 0) {
      throw new ConflictException({
        code: 'SCAN_ALREADY_RUNNING',
        message: 'A scan is already running for this domain',
      });
    }

    const includePaths = (failedScan.includePaths as string[] | null) ?? undefined;
    const excludePaths = (failedScan.excludePaths as string[] | null) ?? undefined;

    const scan = await this.repos.scans.create({
      domainId: domain.id,
      organizationId: domain.organizationId,
      startUrl: failedScan.startUrl,
      maxPages: Math.min(failedScan.maxPages, domain.scanLimit),
      maxDepth: failedScan.maxDepth,
      includePaths,
      excludePaths,
      timeoutMs: failedScan.timeoutMs,
      jsRendering: failedScan.jsRendering,
      deviceType: failedScan.deviceType,
      createdByUserId: user.id,
    });

    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'scan.retried',
      module: 'scanner',
      newValue: { scanId: scan.id, retriedFromScanId: scanId, domainId: domain.id },
      ...meta,
    });

    void this.processScan(scan.id).catch((error) => {
      this.logger.error(
        `Background scan ${scan.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    void this.webhookDelivery.emit(scan.organizationId, 'scan.started', {
      scanId: scan.id,
      domainId: domain.id,
      startUrl: scan.startUrl,
      status: scan.status,
      retriedFromScanId: scanId,
    });
    return this.toSummary(scan);
  }

  async cancelScan(
    user: CurrentUser,
    domainId: string,
    scanId: string,
    meta: AuditMeta,
  ): Promise<ScanSummaryResponse> {
    const domain = await this.getDomainForUser(user, domainId);
    const scan = await this.repos.scans.findById(scanId);
    if (!scan || scan.domainId !== domain.id) {
      throw new NotFoundException({ code: 'SCAN_NOT_FOUND', message: 'Scan not found' });
    }
    if (scan.status !== 'PENDING' && scan.status !== 'RUNNING') {
      throw new BadRequestException({
        code: 'SCAN_NOT_RUNNING',
        message: 'Only pending or running scans can be stopped',
      });
    }

    this.cancelRequests.add(scanId);
    const durationMs = scan.startedAt ? Date.now() - scan.startedAt.getTime() : undefined;
    const live = await this.repos.scans.getLiveProgress(scanId);
    const updated = await this.repos.scans.updateStatus(scanId, 'CANCELLED', {
      completedAt: new Date(),
      durationMs,
      pagesScanned: Math.max(scan.pagesScanned, live.pagesScanned),
      cookiesFound: live.cookiesFound,
      trackersFound: live.trackersFound,
      errorMessage: 'Cancelled by user',
      progressMessage: null,
    });

    this.activeScans.delete(scanId);

    try {
      await this.cookiesService.ingestScanResults(scanId);
    } catch (ingestError) {
      this.logger.warn(
        `Partial ingest after cancel ${scanId}: ${
          ingestError instanceof Error ? ingestError.message : String(ingestError)
        }`,
      );
    }

    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'scan.cancelled',
      module: 'scanner',
      previousValue: { scanId, status: scan.status },
      newValue: { scanId, status: 'CANCELLED' },
      ...meta,
    });

    void this.webhookDelivery.emit(scan.organizationId, 'scan.cancelled', {
      scanId,
      domainId: domain.id,
    });

    return this.toSummary(updated);
  }

  async runDueScans() {
    const due = await this.repos.domains.findDueForScan(new Date());
    for (const domain of due) {
      try {
        const running = await this.repos.scans.countRunningForDomain(domain.id);
        if (running === 0) {
          await this.start(
            this.systemUser(domain.organizationId),
            domain.id,
            {
              startUrl: buildStartUrl(domain.hostname),
              maxPages: domain.scanLimit,
              maxDepth: 3,
              timeoutMs: 30000,
              jsRendering: true,
              deviceType: 'desktop',
            },
            {},
          );
        }
        await this.repos.domains.update(domain.id, {
          nextScanAt: nextScanAtFromFrequency(domain.scanFrequency),
        });
      } catch (error) {
        this.logger.warn(
          `Scheduled scan for domain ${domain.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private systemUser(organizationId: string): CurrentUser {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'scheduler@internal.cmp',
      firstName: 'Scan',
      lastName: 'Scheduler',
      emailVerified: true,
      organizationId,
      roles: ['org_admin'],
      permissions: [],
    };
  }

  private async processScan(scanId: string) {
    if (this.activeScans.has(scanId)) return;
    this.activeScans.add(scanId);

    const startedAt = new Date();
    try {
      const scan = await this.repos.scans.findById(scanId);
      if (!scan) return;

      if (this.cancelRequests.has(scanId)) {
        return;
      }

      await this.repos.scans.updateStatus(scanId, 'RUNNING', {
        startedAt,
        progressMessage: 'Starting scan worker…',
      });

      // Heartbeat from the moment the scan is RUNNING — not after Chromium launches —
      // so a hung browser launch is distinguishable from a dead Cloud Run worker.
      const heartbeat = setInterval(() => {
        void this.repos.scans
          .findById(scanId)
          .then(async (live) => {
            if (live?.status !== 'RUNNING') return;
            await this.repos.scans.updateStatus(scanId, 'RUNNING', {
              pagesScanned: live.pagesScanned,
              cookiesFound: live.cookiesFound,
              trackersFound: live.trackersFound,
              progressMessage: live.progressMessage,
            });
          })
          .catch(() => undefined);
      }, 10_000);

      let result;
      try {
        result = await runWebsiteScan(
          scan,
          async (pageRecord, progress) => {
            try {
              const page = await this.repos.scans.createPage(scanId, {
                url: pageRecord.url,
                canonicalUrl: pageRecord.canonicalUrl,
                status: pageRecord.status,
                depth: pageRecord.depth,
                errorMessage: pageRecord.errorMessage,
              });

              const findings = pageRecord.findings.map((finding) => ({
                ...finding,
                pageId: page.id,
              }));
              if (findings.length > 0) {
                await this.repos.scans.createFindings(scanId, findings);
              }

              await this.repos.scans.updateStatus(scanId, 'RUNNING', {
                pagesScanned: progress.pagesScanned,
                cookiesFound: progress.cookiesFound,
                trackersFound: progress.trackersFound,
              });
            } catch (pageError) {
              this.logger.error(
                `Scan ${scanId} page persist failed: ${
                  pageError instanceof Error ? pageError.message : String(pageError)
                }`,
              );
              await this.repos.scans.updateStatus(scanId, 'RUNNING', {
                pagesScanned: progress.pagesScanned,
                cookiesFound: progress.cookiesFound,
                trackersFound: progress.trackersFound,
              });
            }
          },
          {
            isCancelled: () => this.cancelRequests.has(scanId),
            onHeartbeat: async () => {
              const live = await this.repos.scans.findById(scanId);
              if (live?.status !== 'RUNNING') return;
              await this.repos.scans.updateStatus(scanId, 'RUNNING', {
                pagesScanned: live.pagesScanned,
                cookiesFound: live.cookiesFound,
                trackersFound: live.trackersFound,
                progressMessage: live.progressMessage,
              });
            },
            onStage: async (stage) => {
              await this.repos.scans.updateStatus(scanId, 'RUNNING', {
                progressMessage: stage,
              });
            },
          },
        );
      } finally {
        clearInterval(heartbeat);
      }

      const latest = await this.repos.scans.findById(scanId);
      if (
        !latest ||
        latest.status === 'CANCELLED' ||
        latest.status === 'FAILED' ||
        this.cancelRequests.has(scanId)
      ) {
        // Stall expiry or user cancel already finalized this scan — do not overwrite.
        return;
      }

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const failedPages = result.pageRecords.filter((p) => p.status === 'failed');
      const okPages = result.pageRecords.filter((p) => p.status === 'ok');

      if (result.pagesScanned > 0 && okPages.length === 0 && failedPages.length > 0) {
        const pageError =
          failedPages[0]?.errorMessage ?? 'Page scan failed with no cookie or tracker data';
        this.logger.error(`Scan ${scanId} failed: ${pageError}`);
        await this.repos.scans.updateStatus(scanId, 'FAILED', {
          completedAt,
          durationMs,
          pagesScanned: result.pagesScanned,
          cookiesFound: 0,
          trackersFound: 0,
          errorMessage: pageError,
          progressMessage: null,
        });
        void this.webhookDelivery.emit(scan.organizationId, 'scan.failed', {
          scanId,
          domainId: scan.domainId,
          errorMessage: pageError,
        });
        return;
      }

      const inventoryScan = await this.repos.scans.findById(scanId);
      const siteHostname = getHostname(inventoryScan?.startUrl ?? scan.startUrl) ?? '';
      const inventoryStats = inventoryScan
        ? countInventoryFromFindings(inventoryScan.findings, siteHostname)
        : { inventoryItems: 0, cookies: 0, trackers: 0 };
      const cookiesFound = inventoryStats.cookies;
      const trackersFound = inventoryStats.trackers;

      await this.repos.scans.updateStatus(scanId, 'COMPLETED', {
        completedAt,
        durationMs,
        pagesScanned: result.pagesScanned,
        cookiesFound,
        trackersFound,
        progressMessage: null,
      });

      try {
        await this.cookiesService.ingestScanResults(scanId);
      } catch (ingestError) {
        const ingestMessage =
          ingestError instanceof Error ? ingestError.message : 'Cookie inventory ingest failed';
        this.logger.error(`Scan ${scanId} ingest failed: ${ingestMessage}`);
        await this.repos.scans.updateStatus(scanId, 'COMPLETED', {
          errorMessage: `Scan finished but cookie inventory update failed: ${ingestMessage}`,
        });
      }

      void this.webhookDelivery.emit(scan.organizationId, 'scan.completed', {
        scanId,
        domainId: scan.domainId,
        pagesScanned: result.pagesScanned,
        cookiesFound,
        trackersFound,
        durationMs,
      });
    } catch (error) {
      if (error instanceof ScanCancelledError) {
        const current = await this.repos.scans.findById(scanId);
        if (current && current.status !== 'CANCELLED') {
          const live = await this.repos.scans.getLiveProgress(scanId);
          await this.repos.scans.updateStatus(scanId, 'CANCELLED', {
            completedAt: new Date(),
            durationMs: Date.now() - startedAt.getTime(),
            pagesScanned: Math.max(current.pagesScanned, live.pagesScanned),
            cookiesFound: live.cookiesFound,
            trackersFound: live.trackersFound,
            errorMessage: 'Cancelled by user',
            progressMessage: null,
          });
        }
        try {
          await this.cookiesService.ingestScanResults(scanId);
        } catch (ingestError) {
          this.logger.warn(
            `Partial ingest after cancel ${scanId}: ${
              ingestError instanceof Error ? ingestError.message : String(ingestError)
            }`,
          );
        }
        return;
      }

      const message = error instanceof Error ? error.message : 'Scan failed';
      await this.repos.scans.updateStatus(scanId, 'FAILED', {
        errorMessage: message,
        progressMessage: null,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      });
      const failedScan = await this.repos.scans.findById(scanId);
      if (failedScan) {
        void this.webhookDelivery.emit(failedScan.organizationId, 'scan.failed', {
          scanId,
          domainId: failedScan.domainId,
          errorMessage: message,
        });
      }
    } finally {
      this.activeScans.delete(scanId);
      this.cancelRequests.delete(scanId);
    }
  }

  private async getDomainForUser(user: CurrentUser, domainId: string) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'ORG_REQUIRED', message: 'Organization required' });
    }
    const domain = await this.repos.domains.findById(domainId);
    if (!domain) {
      throw new NotFoundException({ code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' });
    }
    assertSameOrganization(user, domain.organizationId);
    return domain;
  }

  private toSummary(scan: {
    id: string;
    domainId: string;
    status: string;
    startUrl: string;
    maxPages: number;
    maxDepth: number;
    pagesScanned: number;
    cookiesFound: number;
    trackersFound: number;
    errorMessage: string | null;
    progressMessage?: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    durationMs: number | null;
    createdAt: Date;
  }): ScanSummaryResponse {
    const summary: ScanSummaryResponse = {
      id: scan.id,
      domainId: scan.domainId,
      status: scan.status,
      startUrl: scan.startUrl,
      maxPages: scan.maxPages,
      maxDepth: scan.maxDepth,
      pagesScanned: scan.pagesScanned,
      cookiesFound: scan.cookiesFound,
      trackersFound: scan.trackersFound,
      errorMessage: scan.errorMessage,
      progressMessage: scan.progressMessage ?? null,
      startedAt: scan.startedAt?.toISOString() ?? null,
      completedAt: scan.completedAt?.toISOString() ?? null,
      durationMs: scan.durationMs,
      createdAt: scan.createdAt.toISOString(),
    };

    if (scan.status === 'RUNNING' && scan.maxPages > 0) {
      summary.progressPercent = Math.min(
        100,
        Math.round((scan.pagesScanned / scan.maxPages) * 100),
      );
    }

    return summary;
  }

  private toDetail(scan: NonNullable<Awaited<ReturnType<Repositories['scans']['findById']>>>): ScanDetailResponse {
    return {
      ...this.toSummary(scan),
      includePaths: (scan.includePaths as string[] | null) ?? null,
      excludePaths: (scan.excludePaths as string[] | null) ?? null,
      timeoutMs: scan.timeoutMs,
      jsRendering: scan.jsRendering,
      deviceType: scan.deviceType,
      pages: scan.pages.map((page) => ({
        id: page.id,
        url: page.url,
        canonicalUrl: page.canonicalUrl,
        status: page.status,
        depth: page.depth,
        errorMessage: page.errorMessage,
        scannedAt: page.scannedAt.toISOString(),
      })),
      findings: scan.findings.map((finding) => ({
        id: finding.id,
        findingType: finding.findingType,
        consentState: finding.consentState,
        name: finding.name,
        valueSample: finding.valueSample,
        cookieDomain: finding.cookieDomain,
        cookiePath: finding.cookiePath,
        expiresAt: finding.expiresAt?.toISOString() ?? null,
        secure: finding.secure,
        httpOnly: finding.httpOnly,
        sameSite: finding.sameSite,
        isThirdParty: finding.isThirdParty,
        pageUrl: finding.pageUrl,
        technology: finding.technology,
        sourceUrl: finding.sourceUrl,
      })),
    };
  }
}
