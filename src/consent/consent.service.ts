import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Repositories } from '@cmp/database';
import type { CurrentUser } from '@cmp/types';
import type {
  CreateConsentCategoryInput,
  UpdatePolicyVersionInput,
} from '@cmp/validation';
import { REPOS } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { assertSameOrganization } from '../common/guards/tenant.guard';
import type { AuditMeta } from '../organizations/organizations.service';
import {
  snapshotCategories,
  toCategoryResponse,
  toPolicyResponse,
  type ConsentCategoryResponse,
  type ConsentRenewalResponse,
  type PolicyVersionResponse,
} from './consent-response';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';

@Injectable()
export class ConsentService {
  constructor(
    @Inject(REPOS) private readonly repos: Repositories,
    private readonly auditService: AuditService,
    private readonly webhookDelivery: WebhookDeliveryService,
  ) {}

  async listCategories(user: CurrentUser, domainId: string): Promise<ConsentCategoryResponse[]> {
    await this.getDomainForUser(user, domainId);
    const categories = await this.repos.consentCategories.listByDomain(domainId);
    if (categories.length === 0) {
      const domain = await this.repos.domains.findById(domainId);
      if (!domain) throw new NotFoundException({ code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' });
      const seeded = await this.repos.consentCategories.seedDefaults(domainId, domain.organizationId);
      return seeded.map(toCategoryResponse);
    }
    return categories.map(toCategoryResponse);
  }

  async createCategory(
    user: CurrentUser,
    domainId: string,
    input: CreateConsentCategoryInput,
    meta: AuditMeta,
  ): Promise<ConsentCategoryResponse> {
    const domain = await this.getDomainForUser(user, domainId);
    if (input.required && input.slug !== 'strictly_necessary') {
      // custom required categories allowed
    }
    try {
      const category = await this.repos.consentCategories.create({
        domainId,
        organizationId: domain.organizationId,
        ...input,
      });
      await this.auditService.log({
        userId: user.id,
        organizationId: user.organizationId,
        action: 'consent.category_created',
        module: 'consent',
        newValue: { domainId, categoryId: category.id, slug: category.slug },
        ...meta,
      });
      return toCategoryResponse(category);
    } catch (error) {
      if (error instanceof Error && error.message === 'CATEGORY_EXISTS') {
        throw new BadRequestException({ code: 'CATEGORY_EXISTS', message: 'Category slug already exists' });
      }
      throw error;
    }
  }

  async updateCategory(
    user: CurrentUser,
    domainId: string,
    categoryId: string,
    input: Partial<CreateConsentCategoryInput>,
    meta: AuditMeta,
  ): Promise<ConsentCategoryResponse> {
    await this.getDomainForUser(user, domainId);
    const existing = await this.repos.consentCategories.findById(categoryId);
    if (!existing || existing.domainId !== domainId) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }
    if (existing.slug === 'strictly_necessary' && input.required === false) {
      throw new BadRequestException({
        code: 'CATEGORY_REQUIRED',
        message: 'Strictly Necessary cannot be optional',
      });
    }
    const updated = await this.repos.consentCategories.update(
      categoryId,
      input as Prisma.ConsentCategoryUpdateInput,
    );
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'consent.category_updated',
      module: 'consent',
      previousValue: existing,
      newValue: updated,
      ...meta,
    });
    return toCategoryResponse(updated);
  }

  async deleteCategory(
    user: CurrentUser,
    domainId: string,
    categoryId: string,
    remapToCategoryId: string | undefined,
    meta: AuditMeta,
  ): Promise<void> {
    await this.getDomainForUser(user, domainId);
    const existing = await this.repos.consentCategories.findById(categoryId);
    if (!existing || existing.domainId !== domainId) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }
    if (existing.isSystem) {
      throw new BadRequestException({
        code: 'CATEGORY_SYSTEM',
        message: 'System categories cannot be deleted',
      });
    }
    if (this.repos.consentCategories.hasScriptMappings(existing) && !remapToCategoryId) {
      throw new BadRequestException({
        code: 'CATEGORY_REMAP_REQUIRED',
        message: 'Remap scripts and cookies to another category before deleting',
      });
    }
    if (remapToCategoryId) {
      await this.repos.consentCategories.remapAndDelete(categoryId, remapToCategoryId);
    } else {
      await this.repos.consentCategories.delete(categoryId);
    }
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'consent.category_deleted',
      module: 'consent',
      previousValue: existing,
      newValue: { remapToCategoryId },
      ...meta,
    });
  }

  async reorderCategories(
    user: CurrentUser,
    domainId: string,
    orderedIds: string[],
    meta: AuditMeta,
  ): Promise<ConsentCategoryResponse[]> {
    await this.getDomainForUser(user, domainId);
    const categories = await this.repos.consentCategories.reorder(domainId, orderedIds);
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'consent.categories_reordered',
      module: 'consent',
      newValue: { domainId, orderedIds },
      ...meta,
    });
    return categories.map(toCategoryResponse);
  }

  async listPolicies(user: CurrentUser, domainId: string): Promise<PolicyVersionResponse[]> {
    await this.getDomainForUser(user, domainId);
    await this.repos.policyVersions.publishScheduled();
    const policies = await this.repos.policyVersions.listByDomain(domainId);
    return policies.map(toPolicyResponse);
  }

  async getDraftPolicy(user: CurrentUser, domainId: string): Promise<PolicyVersionResponse> {
    const domain = await this.getDomainForUser(user, domainId);
    const draft = await this.repos.policyVersions.getOrCreateDraft(domainId, domain.organizationId);
    return toPolicyResponse(draft);
  }

  async updateDraftPolicy(
    user: CurrentUser,
    domainId: string,
    policyId: string,
    input: UpdatePolicyVersionInput,
    meta: AuditMeta,
  ): Promise<PolicyVersionResponse> {
    await this.getDomainForUser(user, domainId);
    const policy = await this.repos.policyVersions.findById(policyId);
    if (!policy || policy.domainId !== domainId) {
      throw new NotFoundException({ code: 'POLICY_NOT_FOUND', message: 'Policy version not found' });
    }
    if (policy.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'POLICY_IMMUTABLE',
        message: 'Only draft policies can be edited',
      });
    }
    const updated = await this.repos.policyVersions.update(
      policyId,
      input as Prisma.PolicyVersionUpdateInput,
    );
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'consent.policy_updated',
      module: 'consent',
      newValue: { domainId, policyId },
      ...meta,
    });
    return toPolicyResponse(updated);
  }

  async publishPolicy(
    user: CurrentUser,
    domainId: string,
    policyId: string,
    changeSummary: string | undefined,
    meta: AuditMeta,
  ): Promise<PolicyVersionResponse> {
    await this.getDomainForUser(user, domainId);
    const policy = await this.repos.policyVersions.findById(policyId);
    if (!policy || policy.domainId !== domainId) {
      throw new NotFoundException({ code: 'POLICY_NOT_FOUND', message: 'Policy version not found' });
    }
    const categories = await this.repos.consentCategories.listByDomain(domainId);
    const snapshot = snapshotCategories(categories);
    if (changeSummary) {
      await this.repos.policyVersions.update(policyId, { changeSummary });
    }
    try {
      const published = await this.repos.policyVersions.publish(policyId, domainId, snapshot);
      await this.repos.policyVersions.getOrCreateDraft(domainId, policy.organizationId);
      await this.auditService.log({
        userId: user.id,
        organizationId: user.organizationId,
        action: 'consent.policy_published',
        module: 'consent',
        newValue: { domainId, policyId, versionNumber: published.versionNumber },
        ...meta,
      });
      void this.webhookDelivery.emit(policy.organizationId, 'policy.published', {
        domainId,
        policyVersionId: published.id,
        versionNumber: published.versionNumber,
        publishedAt: published.publishedAt?.toISOString() ?? null,
      });
      return toPolicyResponse(published);
    } catch (error) {
      if (error instanceof Error && error.message === 'POLICY_NOT_PUBLISHABLE') {
        throw new BadRequestException({
          code: 'POLICY_NOT_PUBLISHABLE',
          message: 'Only draft or scheduled policies can be published',
        });
      }
      throw error;
    }
  }

  async schedulePolicy(
    user: CurrentUser,
    domainId: string,
    policyId: string,
    scheduledAt: string,
    changeSummary: string | undefined,
    meta: AuditMeta,
  ): Promise<PolicyVersionResponse> {
    await this.getDomainForUser(user, domainId);
    const policy = await this.repos.policyVersions.findById(policyId);
    if (!policy || policy.domainId !== domainId || policy.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'POLICY_NOT_SCHEDULABLE',
        message: 'Only draft policies can be scheduled',
      });
    }
    const categories = await this.repos.consentCategories.listByDomain(domainId);
    const snapshot = snapshotCategories(categories);
    const scheduled = await this.repos.policyVersions.schedule(
      policyId,
      new Date(scheduledAt),
      snapshot,
    );
    if (changeSummary) {
      await this.repos.policyVersions.update(policyId, { changeSummary });
    }
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'consent.policy_scheduled',
      module: 'consent',
      newValue: { domainId, policyId, scheduledAt },
      ...meta,
    });
    return toPolicyResponse(scheduled);
  }

  async archivePolicy(
    user: CurrentUser,
    domainId: string,
    policyId: string,
    meta: AuditMeta,
  ): Promise<PolicyVersionResponse> {
    await this.getDomainForUser(user, domainId);
    const policy = await this.repos.policyVersions.findById(policyId);
    if (!policy || policy.domainId !== domainId) {
      throw new NotFoundException({ code: 'POLICY_NOT_FOUND', message: 'Policy version not found' });
    }
    if (policy.status === 'PUBLISHED') {
      throw new BadRequestException({
        code: 'POLICY_PUBLISHED',
        message: 'Published policies cannot be archived directly. Publish a new version instead.',
      });
    }
    const archived = await this.repos.policyVersions.archive(policyId);
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'consent.policy_archived',
      module: 'consent',
      newValue: { domainId, policyId },
      ...meta,
    });
    return toPolicyResponse(archived);
  }

  async triggerRenewal(
    user: CurrentUser,
    domainId: string,
    reason: string,
    scope: string,
    metadata: Record<string, unknown> | undefined,
    meta: AuditMeta,
  ): Promise<ConsentRenewalResponse> {
    const domain = await this.getDomainForUser(user, domainId);
    const published = await this.repos.policyVersions.findPublished(domainId);
    if (!published) {
      throw new BadRequestException({
        code: 'NO_PUBLISHED_POLICY',
        message: 'Publish a policy before triggering consent renewal',
      });
    }
    await this.repos.policyVersions.markRequiresRenewal(domainId, { reason, metadata });
    const renewal = await this.repos.consentRenewals.create({
      domainId,
      organizationId: domain.organizationId,
      policyVersionId: published.id,
      reason,
      scope,
      triggeredBy: user.id,
      metadata,
    });
    await this.repos.domains.update(domainId, { configVersion: { increment: 1 } });
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'consent.renewal_triggered',
      module: 'consent',
      newValue: { domainId, reason, renewalId: renewal.id },
      ...meta,
    });
    return {
      id: renewal.id,
      domainId: renewal.domainId,
      organizationId: renewal.organizationId,
      policyVersionId: renewal.policyVersionId,
      reason: renewal.reason,
      scope: renewal.scope,
      triggeredBy: renewal.triggeredBy,
      metadata: renewal.metadata,
      createdAt: renewal.createdAt,
    };
  }

  async listRenewals(user: CurrentUser, domainId: string): Promise<ConsentRenewalResponse[]> {
    await this.getDomainForUser(user, domainId);
    const renewals = await this.repos.consentRenewals.listByDomain(domainId);
    return renewals.map((renewal) => ({
      id: renewal.id,
      domainId: renewal.domainId,
      organizationId: renewal.organizationId,
      policyVersionId: renewal.policyVersionId,
      reason: renewal.reason,
      scope: renewal.scope,
      triggeredBy: renewal.triggeredBy,
      metadata: renewal.metadata,
      createdAt: renewal.createdAt,
    }));
  }

  async getPublishedConfig(domainId: string): Promise<{
    policyVersionId: string;
    versionNumber: number;
    requiresRenewal: boolean;
    renewalReason: unknown;
    categories: unknown;
    banner: unknown;
    legalText: unknown;
    regulationConfig: unknown;
    defaultConsentStates: unknown;
    supportedLanguages: unknown;
  } | null> {
    await this.repos.policyVersions.publishScheduled();
    const published = await this.repos.policyVersions.findPublished(domainId);
    if (!published) return null;
    return {
      policyVersionId: published.id,
      versionNumber: published.versionNumber,
      requiresRenewal: published.requiresRenewal,
      renewalReason: published.renewalReason,
      categories: published.categoriesSnapshot,
      banner: published.bannerContent,
      legalText: published.legalText,
      regulationConfig: published.regulationConfig,
      defaultConsentStates: published.defaultConsentStates,
      supportedLanguages: published.supportedLanguages,
    };
  }

  private async getDomainForUser(user: CurrentUser, domainId: string) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'NO_ORG', message: 'No organization found' });
    }
    const domain = await this.repos.domains.findById(domainId);
    if (!domain) {
      throw new NotFoundException({ code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' });
    }
    assertSameOrganization(user, domain.organizationId);
    return domain;
  }
}
