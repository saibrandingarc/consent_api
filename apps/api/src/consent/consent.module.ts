import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';
import { TranslationService } from './translation.service';

@Module({
  imports: [AuditModule, WebhooksModule],
  controllers: [ConsentController],
  providers: [ConsentService, TranslationService],
  exports: [ConsentService],
})
export class ConsentModule {}
