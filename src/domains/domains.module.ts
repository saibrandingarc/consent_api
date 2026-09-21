import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { DomainVerificationService } from './domain-verification.service';

@Module({
  imports: [AuditModule],
  controllers: [DomainsController],
  providers: [DomainsService, DomainVerificationService],
  exports: [DomainsService, DomainVerificationService],
})
export class DomainsModule {}
