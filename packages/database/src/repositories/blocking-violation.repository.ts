import type { PrismaClient } from '@prisma/client';

export class BlockingViolationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  createMany(
    domainId: string,
    organizationId: string,
    violations: Array<{
      url: string;
      resourceType: string;
      category?: string | null;
      vendor?: string | null;
      rulePattern?: string | null;
      pageUrl?: string | null;
    }>,
  ) {
    if (violations.length === 0) return { count: 0 };
    return this.prisma.blockingViolation.createMany({
      data: violations.map((item) => ({
        domainId,
        organizationId,
        url: item.url,
        resourceType: item.resourceType,
        category: item.category,
        vendor: item.vendor,
        rulePattern: item.rulePattern,
        pageUrl: item.pageUrl,
      })),
    });
  }

  listByDomain(domainId: string, limit = 100) {
    return this.prisma.blockingViolation.findMany({
      where: { domainId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  countRecentByDomain(domainId: string, since: Date) {
    return this.prisma.blockingViolation.count({
      where: { domainId, createdAt: { gte: since } },
    });
  }

  countRecent(organizationId: string, withinDays: number) {
    const since = new Date(Date.now() - withinDays * 86_400_000);
    return this.prisma.blockingViolation.count({
      where: { organizationId, createdAt: { gte: since } },
    });
  }
}
