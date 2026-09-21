import type { CmpConfig } from '../types';
import { evaluateBlocking, rulesFromConfig } from './engine-rules';
import type { BlockingEvent } from './event-log';
import { BlockingEventLog } from './event-log';
import { DomInterceptor } from './dom-interceptor';
import { ManualBlockingController } from './manual-blocking';
import { NetworkInterceptor } from './network-interceptor';
import { mountBlockingDebugger } from './debugger';
import type { BlockingRule } from './types';

export class AutomaticBlockingController {
  private readonly rules: BlockingRule[];
  private readonly log = new BlockingEventLog();
  private readonly manual: ManualBlockingController;
  private dom?: DomInterceptor;
  private network?: NetworkInterceptor;
  private debuggerCleanup?: () => void;
  private violationBuffer: Array<Record<string, unknown>> = [];
  private reportTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly config: CmpConfig,
    private getConsent: () => Record<string, boolean>,
    private onOpenPreferences: () => void,
    private readonly onReportViolations?: (violations: Record<string, unknown>[]) => void,
  ) {
    this.rules = rulesFromConfig(config);
    this.manual = new ManualBlockingController(config, getConsent, onOpenPreferences);
  }

  start() {
    const visitorRegion =
      this.config.region ?? this.config.visitorGeo?.region ?? null;
    const evaluate = (url: string, type: BlockingRule['type']) =>
      evaluateBlocking(this.rules, this.getConsent(), url, type, visitorRegion);

    const onViolation = (payload: Record<string, unknown>) => {
      this.violationBuffer.push(payload);
      this.scheduleViolationReport();
    };

    this.dom = new DomInterceptor({
      evaluate,
      log: this.log,
      onViolation,
      onOpenPreferences: this.onOpenPreferences,
    });

    this.network = new NetworkInterceptor({
      evaluate,
      log: this.log,
      onViolation,
    });

    this.manual.scanDOM();
    this.manual.sync(this.getConsent());

    if (this.config.debugMode) {
      this.debuggerCleanup = mountBlockingDebugger(this.log, () => this.onOpenPreferences());
    }
  }

  sync(consent: Record<string, boolean>) {
    this.manual.sync(consent);
  }

  getEvents(): BlockingEvent[] {
    return this.log.list();
  }

  getViolationCount() {
    return this.log.violationCount();
  }

  destroy() {
    this.dom?.destroy();
    this.network?.destroy();
    this.manual.destroy();
    this.debuggerCleanup?.();
    if (this.reportTimer) clearTimeout(this.reportTimer);
  }

  private scheduleViolationReport() {
    if (!this.onReportViolations) return;
    if (this.reportTimer) return;
    this.reportTimer = setTimeout(() => {
      const batch = this.violationBuffer.slice(0, 20);
      this.violationBuffer = this.violationBuffer.slice(20);
      this.reportTimer = undefined;
      if (batch.length > 0) this.onReportViolations!(batch);
      if (this.violationBuffer.length > 0) this.scheduleViolationReport();
    }, 2000);
  }
}
