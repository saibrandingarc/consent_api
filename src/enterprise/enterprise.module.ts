import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';
import { RetentionSchedulerService } from './retention-scheduler.service';

@Module({
  imports: [AuditModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService, RetentionSchedulerService],
  exports: [EnterpriseService],
})
export class EnterpriseModule {}
