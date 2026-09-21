import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { UsersController } from './users.controller';

@Module({
  imports: [AuditModule, EmailModule],
  controllers: [UsersController],
})
export class UsersModule {}
