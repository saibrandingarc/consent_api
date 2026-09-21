import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { PERMISSIONS } from '@cmp/auth';
import { assignRoleSchema, inviteUserSchema } from '@cmp/validation';
import type { Repositories } from '@cmp/database';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { assertSameOrganization } from '../common/guards/tenant.guard';
import { REPOS } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(REPOS) private readonly repos: Repositories,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  async list(@CurrentUserDecorator() user: CurrentUser) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }
    const users = await this.repos.users.listByOrganization(user.organizationId);
    return ok(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        status: u.status,
        emailVerified: u.emailVerified,
        roles: u.roles.map((r) => r.role.slug),
        createdAt: u.createdAt,
      })),
    );
  }

  @Post('invite')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  async invite(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(inviteUserSchema))
    body: { email: string; firstName: string; lastName: string; roleSlug: string },
    @Req() req: Request,
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }

    const existing = await this.repos.users.findByEmail(body.email);
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Email already registered' });
    }

    const org = await this.repos.organizations.findById(user.organizationId);
    const tempPassword = randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const newUser = await this.repos.users.create({
      email: body.email.toLowerCase(),
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      status: 'PENDING',
      emailVerified: false,
      organization: { connect: { id: user.organizationId } },
    });

    await this.repos.users.assignRole(newUser.id, body.roleSlug);

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repos.authTokens.createPasswordResetToken(newUser.id, tokenHash, expiresAt);
    await this.emailService.sendInviteEmail(body.email, token, org?.name ?? 'your organization');

    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'user.invited',
      module: 'user',
      newValue: { userId: newUser.id, email: body.email, roleSlug: body.roleSlug },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });

    return ok({ userId: newUser.id, message: 'Invitation sent' });
  }

  @Post('assign-role')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  async assignRole(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(assignRoleSchema)) body: { userId: string; roleSlug: string },
    @Req() req: Request,
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }

    const target = await this.repos.users.findById(body.userId);
    if (!target) {
      throw new BadRequestException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    assertSameOrganization(user, target.organizationId);

    if (body.roleSlug === 'super_admin' && !user.roles.includes('super_admin')) {
      throw new BadRequestException({
        code: 'FORBIDDEN',
        message: 'Cannot assign super_admin role',
      });
    }

    await this.repos.users.replaceRole(body.userId, body.roleSlug);

    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'user.role_assigned',
      module: 'user',
      newValue: { userId: body.userId, roleSlug: body.roleSlug },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });

    return ok({ message: 'Role assigned' });
  }
}
