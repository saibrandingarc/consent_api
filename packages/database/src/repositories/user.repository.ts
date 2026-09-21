import type { Prisma, PrismaClient } from '@prisma/client';

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        customRoles: { include: { customRole: true } },
        organization: true,
      },
    });
  }

  findByAuth0Sub(auth0Sub: string) {
    return this.prisma.user.findUnique({
      where: { auth0Sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        customRoles: { include: { customRole: true } },
        organization: true,
      },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        customRoles: { include: { customRole: true } },
        organization: true,
      },
    });
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  listByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignRole(userId: string, roleSlug: string) {
    const role = await this.prisma.role.findUnique({ where: { slug: roleSlug } });
    if (!role) throw new Error(`Role not found: ${roleSlug}`);

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  recordLoginHistory(userId: string, success: boolean, ipAddress?: string, userAgent?: string) {
    return this.prisma.loginHistory.create({
      data: { userId, success, ipAddress, userAgent },
    });
  }

  listLoginHistory(userId: string, limit = 50) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async replaceRole(userId: string, roleSlug: string) {
    const role = await this.prisma.role.findUnique({ where: { slug: roleSlug } });
    if (!role) throw new Error(`Role not found: ${roleSlug}`);

    await this.prisma.userRole.deleteMany({ where: { userId } });
    return this.prisma.userRole.create({
      data: { userId, roleId: role.id },
    });
  }

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        permissions: { include: { permission: true } },
      },
    });
  }
}
