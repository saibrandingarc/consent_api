import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CookiesController } from './cookies.controller';
import { CookiesService } from './cookies.service';

@Module({
  imports: [AuditModule],
  controllers: [CookiesController],
  providers: [CookiesService],
  exports: [CookiesService],
})
export class CookiesModule {}
