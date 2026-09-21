import type { Prisma, PrismaClient } from '@prisma/client';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export class OrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.organization.findFirst({
      where: { slug, deletedAt: null },
    });
  }

  async createUnique(data: {
    name: string;
    legalName?: string;
    country?: string;
    timezone?: string;
    defaultLanguage?: string;
    billingEmail?: string;
  }) {
    const baseSlug = slugify(data.name) || 'organization';
    let slug = baseSlug;
    let attempt = 0;

    while (await this.findBySlug(slug)) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
    }

    return this.prisma.organization.create({
      data: {
        name: data.name,
        slug,
        legalName: data.legalName,
        country: data.country,
        timezone: data.timezone,
        defaultLanguage: data.defaultLanguage,
        billingEmail: data.billingEmail,
      },
    });
  }

  update(id: string, data: Prisma.OrganizationUpdateInput) {
    return this.prisma.organization.update({ where: { id }, data });
  }

  listActive() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
    });
  }

  softDelete(id: string) {
    return this.prisma.organization.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
  }

  async permanentDelete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.installationValidation.deleteMany({ where: { organizationId: id } });
      await tx.domain.deleteMany({ where: { organizationId: id } });
      await tx.auditLog.deleteMany({ where: { organizationId: id } });
      const users = await tx.user.findMany({ where: { organizationId: id }, select: { id: true } });
      for (const user of users) {
        await tx.userRole.deleteMany({ where: { userId: user.id } });
        await tx.refreshToken.deleteMany({ where: { userId: user.id } });
        await tx.loginHistory.deleteMany({ where: { userId: user.id } });
        await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await tx.user.delete({ where: { id: user.id } });
      }
      return tx.organization.delete({ where: { id } });
    });
  }
}
