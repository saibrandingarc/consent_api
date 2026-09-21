import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUser } from '@cmp/types';
import type { Repositories } from '@cmp/database';
import { generateApiKeyMaterial } from '@cmp/database';
import { REPOS } from '../database/database.module';
import { assertSameOrganization } from '../common/guards/tenant.guard';

@Injectable()
export class ApiKeysService {
  constructor(@Inject(REPOS) private readonly repos: Repositories) {}

  async list(user: CurrentUser) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'ORG_REQUIRED', message: 'Organization required' });
    }
    const keys = await this.repos.apiKeys.listByOrganization(user.organizationId);
    return keys.map((key) => this.toResponse(key));
  }

  async create(
    user: CurrentUser,
    input: {
      name: string;
      environment: 'PRODUCTION' | 'SANDBOX';
      scopes: string[];
      expiresAt?: string;
    },
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'ORG_REQUIRED', message: 'Organization required' });
    }
    const material = generateApiKeyMaterial(input.environment);
    const record = await this.repos.apiKeys.create({
      organizationId: user.organizationId,
      name: input.name,
      keyPrefix: material.keyPrefix,
      keyHash: material.keyHash,
      scopes: input.scopes,
      environment: input.environment,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdByUserId: user.id,
    });
    return {
      ...this.toResponse(record),
      key: material.fullKey,
      warning: 'Copy this key now. It will not be shown again.',
    };
  }

  async revoke(user: CurrentUser, id: string) {
    const record = await this.repos.apiKeys.findById(id);
    if (!record) {
      throw new NotFoundException({ code: 'API_KEY_NOT_FOUND', message: 'API key not found' });
    }
    assertSameOrganization(user, record.organizationId);
    await this.repos.apiKeys.revoke(id);
    return { revoked: true };
  }

  private toResponse(key: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: unknown;
    environment: string;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes as string[],
      environment: key.environment,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      expiresAt: key.expiresAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
    };
  }
}
