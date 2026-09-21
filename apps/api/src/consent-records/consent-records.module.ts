import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConsentModule } from '../consent/consent.module';
import { ConsentRecordsController } from './consent-records.controller';
import { ConsentRecordsService } from './consent-records.service';

@Module({
  imports: [ConsentModule, AuditModule],
  controllers: [ConsentRecordsController],
  providers: [ConsentRecordsService],
  exports: [ConsentRecordsService],
})
export class ConsentRecordsModule {}
