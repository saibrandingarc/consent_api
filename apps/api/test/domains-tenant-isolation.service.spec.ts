import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@cmp/types';
import { REPOS } from '../src/database/database.module';
import { AuditService } from '../src/audit/audit.service';
import { CookiesService } from '../src/cookies/cookies.service';
import { WebhookDeliveryService } from '../src/webhooks/webhook-delivery.service';
import { ScansService } from '../src/scans/scans.service';

describe('ScansService tenant isolation', () => {
  let service: ScansService;

  const userOrgA: CurrentUser = {
    id: 'user-a',
    email: 'a@test.com',
    firstName: 'A',
    lastName: 'User',
    emailVerified: true,
    organizationId: 'org-a',
    roles: ['org_admin'],
    permissions: ['scan.view'],
  };

  const mockRepos = {
    domains: {
      findById: vi.fn(),
    },
    scans: {
      findById: vi.fn(),
      listByDomain: vi.fn(),
      countRunningForDomain: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      createPage: vi.fn(),
      createFindings: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ScansService,
        { provide: REPOS, useValue: mockRepos },
        { provide: AuditService, useValue: { log: vi.fn() } },
        { provide: CookiesService, useValue: { ingestScanResults: vi.fn() } },
        { provide: WebhookDeliveryService, useValue: { emit: vi.fn() } },
      ],
    }).compile();

    service = module.get(ScansService);
  });

  it('throws when get is called for a domain in another organization', async () => {
    mockRepos.domains.findById.mockResolvedValue({
      id: 'domain-b',
      organizationId: 'org-b',
    });

    await expect(service.get(userOrgA, 'domain-b', 'scan-1')).rejects.toThrow(ForbiddenException);
    expect(mockRepos.scans.findById).not.toHaveBeenCalled();
  });
});
