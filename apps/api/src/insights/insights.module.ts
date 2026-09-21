import { Module } from '@nestjs/common';
import { ConsentRecordsModule } from '../consent-records/consent-records.module';
import { EmailModule } from '../email/email.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { ReportSchedulerService } from './report-scheduler.service';

@Module({
  imports: [EmailModule, ConsentRecordsModule],
  controllers: [InsightsController],
  providers: [InsightsService, ReportSchedulerService],
})
export class InsightsModule {}
