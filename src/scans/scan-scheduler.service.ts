import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ScansService } from './scans.service';

const TICK_MS = 3_600_000;

@Injectable()
export class ScanSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly scansService: ScansService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    this.logger.log(`Scan scheduler started (interval ${TICK_MS / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.scansService.runDueScans();
    } catch (error) {
      this.logger.error(
        `Scan scheduler tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
