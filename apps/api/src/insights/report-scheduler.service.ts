import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InsightsService } from './insights.service';

const TICK_MS = 60_000;

@Injectable()
export class ReportSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly insightsService: InsightsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    this.logger.log(`Report scheduler started (interval ${TICK_MS / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.insightsService.runDueSchedules();
    } catch (error) {
      this.logger.error(
        `Report scheduler tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
