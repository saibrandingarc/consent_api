import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DomainsModule } from './domains/domains.module';
import { ConsentModule } from './consent/consent.module';
import { ConsentRecordsModule } from './consent-records/consent-records.module';
import { ScansModule } from './scans/scans.module';
import { CookiesModule } from './cookies/cookies.module';
import { BlockingModule } from './blocking/blocking.module';
import { PublicCmpModule } from './public/public-cmp.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { InsightsModule } from './insights/insights.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DeveloperModule } from './developer/developer.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { AiModule } from './ai/ai.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    DomainsModule,
    ConsentModule,
    ConsentRecordsModule,
    ScansModule,
    CookiesModule,
    BlockingModule,
    PublicCmpModule,
    AuditModule,
    UsersModule,
    RolesModule,
    InsightsModule,
    ApiKeysModule,
    WebhooksModule,
    DeveloperModule,
    EnterpriseModule,
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
