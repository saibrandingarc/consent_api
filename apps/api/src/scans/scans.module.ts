import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CookiesModule } from '../cookies/cookies.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { ScanSchedulerService } from './scan-scheduler.service';

@Module({
  imports: [AuditModule, CookiesModule, WebhooksModule],
  controllers: [ScansController],
  providers: [ScansService, ScanSchedulerService],
  exports: [ScansService],
})
export class ScansModule {}
