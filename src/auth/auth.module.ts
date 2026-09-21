import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JWT_CONFIG } from '@cmp/config';
import { EmailModule } from '../email/email.module';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { Auth0ConfigService } from './auth0-config.service';
import { AuthService } from './auth.service';
import { Auth0Service } from './auth0.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: JWT_CONFIG.accessSecret(),
      signOptions: { expiresIn: JWT_CONFIG.accessExpiresIn },
    }),
    EmailModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, Auth0Service, Auth0ConfigService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
