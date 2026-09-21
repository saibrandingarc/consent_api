import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUser } from '@cmp/types';
import type { Repositories } from '@cmp/database';
import { generateWebhookSecret } from '@cmp/database';
import { REPOS } from '../database/database.module';
import { assertSameOrganization } from '../common/guards/tenant.guard';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(REPOS) private readonly repos: Repositories,
    private readonly deliveryService: WebhookDeliveryService,
  ) {}

  async listEndpoints(user: CurrentUser) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'ORG_REQUIRED', message: 'Organization required' });
    }
    const endpoints = await this.repos.webhooks.listEndpoints(user.organizationId);
    return endpoints.map((endpoint) => this.toEndpointResponse(endpoint));
  }

  async createEndpoint(
    user: CurrentUser,
    input: { url: string; events: string[]; description?: string; enabled?: boolean },
  ) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'ORG_REQUIRED', message: 'Organization required' });
    }
    const secretMaterial = generateWebhookSecret();
    const endpoint = await this.repos.webhooks.createEndpoint({
      organizationId: user.organizationId,
      url: input.url,
      secret: secretMaterial.secret,
      secretPrefix: secretMaterial.secretPrefix,
      events: input.events,
      description: input.description,
    });
    if (input.enabled === false) {
      await this.repos.webhooks.updateEndpoint(endpoint.id, { enabled: false });
    }
    return {
      ...this.toEndpointResponse(endpoint),
      secret: secretMaterial.secret,
      warning: 'Copy this signing secret now. It will not be shown again.',
    };
  }

  async updateEndpoint(
    user: CurrentUser,
    id: string,
    input: { url?: string; events?: string[]; description?: string; enabled?: boolean },
  ) {
    const endpoint = await this.getEndpointForUser(user, id);
    const updated = await this.repos.webhooks.updateEndpoint(id, {
      url: input.url,
      events: input.events,
      description: input.description,
      enabled: input.enabled,
    });
    return this.toEndpointResponse(updated);
  }

  async deleteEndpoint(user: CurrentUser, id: string) {
    await this.getEndpointForUser(user, id);
    await this.repos.webhooks.deleteEndpoint(id);
    return { deleted: true };
  }

  async rotateSecret(user: CurrentUser, id: string) {
    const endpoint = await this.getEndpointForUser(user, id);
    const secretMaterial = generateWebhookSecret();
    await this.repos.webhooks.updateEndpoint(endpoint.id, {
      secret: secretMaterial.secret,
      secretPrefix: secretMaterial.secretPrefix,
    });
    return {
      id: endpoint.id,
      secretPrefix: secretMaterial.secretPrefix,
      secret: secretMaterial.secret,
      warning: 'Copy this signing secret now. It will not be shown again.',
    };
  }

  async listDeliveries(user: CurrentUser, webhookEndpointId?: string) {
    if (!user.organizationId) {
      throw new BadRequestException({ code: 'ORG_REQUIRED', message: 'Organization required' });
    }
    if (webhookEndpointId) {
      const endpoint = await this.getEndpointForUser(user, webhookEndpointId);
      void endpoint;
    }
    const deliveries = await this.repos.webhooks.listDeliveries(
      user.organizationId,
      webhookEndpointId,
    );
    return deliveries.map((delivery) => this.toDeliveryResponse(delivery));
  }

  async retryDelivery(user: CurrentUser, deliveryId: string) {
    const delivery = await this.repos.webhooks.findDelivery(deliveryId);
    if (!delivery) {
      throw new NotFoundException({ code: 'DELIVERY_NOT_FOUND', message: 'Delivery not found' });
    }
    assertSameOrganization(user, delivery.organizationId);
    const updated = await this.deliveryService.retryDelivery(deliveryId);
    return updated ? this.toDeliveryResponse(updated) : null;
  }

  private async getEndpointForUser(user: CurrentUser, id: string) {
    const endpoint = await this.repos.webhooks.findEndpointById(id);
    if (!endpoint) {
      throw new NotFoundException({ code: 'WEBHOOK_NOT_FOUND', message: 'Webhook endpoint not found' });
    }
    assertSameOrganization(user, endpoint.organizationId);
    return endpoint;
  }

  private toEndpointResponse(endpoint: {
    id: string;
    url: string;
    secretPrefix: string;
    events: unknown;
    enabled: boolean;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: endpoint.id,
      url: endpoint.url,
      secretPrefix: endpoint.secretPrefix,
      events: endpoint.events as string[],
      enabled: endpoint.enabled,
      description: endpoint.description,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
    };
  }

  private toDeliveryResponse(delivery: {
    id: string;
    webhookEndpointId: string;
    eventType: string;
    status: string;
    attemptCount: number;
    lastAttemptAt: Date | null;
    responseStatus: number | null;
    errorMessage: string | null;
    deliveredAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: delivery.id,
      webhookEndpointId: delivery.webhookEndpointId,
      eventType: delivery.eventType,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
      responseStatus: delivery.responseStatus,
      errorMessage: delivery.errorMessage,
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
    };
  }
}
