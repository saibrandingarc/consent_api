import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Repositories } from '@cmp/database';
import type { CurrentUser } from '@cmp/types';
import { REPOS } from '../database/database.module';
import { assertSameOrganization } from '../common/guards/tenant.guard';
import { buildVendorPatterns } from './vendor-patterns.util';

const KNOWN_TRACKER_PATTERNS = [
  { category: 'analytics', type: 'script', pattern: 'googletagmanager.com' },
  { category: 'analytics', type: 'script', pattern: 'google-analytics.com' },
  { category: 'marketing', type: 'script', pattern: 'connect.facebook.net' },
  { category: 'marketing', type: 'fetch', pattern: 'doubleclick.net' },
  { category: 'social_media', type: 'iframe', pattern: 'youtube.com/embed' },
];

@Injectable()
export class BlockingService {
  constructor(@Inject(REPOS) private readonly repos: Repositories) {}

  async listViolations(user: CurrentUser, domainId: string) {
    const domain = await this.getDomainForUser(user, domainId);
    const violations = await this.repos.blockingViolations.listByDomain(domain.id);
    return violations.map((item) => ({
      id: item.id,
      url: item.url,
      resourceType: item.resourceType,
      category: item.category,
      vendor: item.vendor,
      rulePattern: item.rulePattern,
      pageUrl: item.pageUrl,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async listRules(user: CurrentUser, domainId: string): Promise<{
    categoryRules: Array<{ slug: string; name: string; scriptMappings: unknown }>;
    vendorPatterns: ReturnType<typeof buildVendorPatterns>;
    knownTrackerPatterns: typeof KNOWN_TRACKER_PATTERNS;
  }> {
    const domain = await this.getDomainForUser(user, domainId);
    const categories = await this.repos.consentCategories.listByDomain(domain.id);
    const definitions = await this.repos.cookies.listDefinitions(domain.organizationId);

    return {
      categoryRules: categories.map((category) => ({
        slug: category.slug,
        name: category.name,
        scriptMappings: category.scriptMappings,
      })),
      vendorPatterns: buildVendorPatterns(definitions),
      knownTrackerPatterns: KNOWN_TRACKER_PATTERNS,
    };
  }

  async recordViolations(
    domainKey: string,
    violations: Array<{
      url: string;
      resourceType: string;
      category?: string;
      vendor?: string;
      rulePattern?: string;
      pageUrl?: string;
    }>,
  ) {
    const domain = await this.repos.domains.findByDomainKey(domainKey);
    if (!domain || !domain.enabled) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Domain not found' });
    }

    await this.repos.blockingViolations.createMany(domain.id, domain.organizationId, violations);
    return { recorded: violations.length };
  }

  private async getDomainForUser(user: CurrentUser, domainId: string) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'ORG_REQUIRED', message: 'Organization required' });
    }
    const domain = await this.repos.domains.findById(domainId);
    if (!domain) {
      throw new NotFoundException({ code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' });
    }
    assertSameOrganization(user, domain.organizationId);
    return domain;
  }
}
