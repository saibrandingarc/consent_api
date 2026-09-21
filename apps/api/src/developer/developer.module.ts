import { Module } from '@nestjs/common';
import { ScansModule } from '../scans/scans.module';
import { ConsentRecordsModule } from '../consent-records/consent-records.module';
import { CookiesModule } from '../cookies/cookies.module';
import { ConsentModule } from '../consent/consent.module';
import { DomainsModule } from '../domains/domains.module';
import { DeveloperController } from './developer.controller';
import { DeveloperService } from './developer.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [ScansModule, ConsentRecordsModule, CookiesModule, ConsentModule, DomainsModule],
  controllers: [DeveloperController],
  providers: [DeveloperService, ApiKeyGuard],
  exports: [DeveloperService],
})
export class DeveloperModule {}
