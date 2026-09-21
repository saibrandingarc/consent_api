import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@cmp/auth';
import {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
} from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
@RequirePermissions(PERMISSIONS.INTEGRATION_MANAGE)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  list(@CurrentUserDecorator() user: CurrentUser) {
    return this.webhooksService.listEndpoints(user).then(ok);
  }

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(createWebhookEndpointSchema)) body: unknown,
  ) {
    return this.webhooksService
      .createEndpoint(user, body as Parameters<WebhooksService['createEndpoint']>[1])
      .then(ok);
  }

  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWebhookEndpointSchema)) body: unknown,
  ) {
    return this.webhooksService
      .updateEndpoint(user, id, body as Parameters<WebhooksService['updateEndpoint']>[2])
      .then(ok);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.webhooksService.deleteEndpoint(user, id).then(ok);
  }

  @Post(':id/rotate-secret')
  rotateSecret(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.webhooksService.rotateSecret(user, id).then(ok);
  }

  @Get('deliveries')
  listDeliveries(
    @CurrentUserDecorator() user: CurrentUser,
    @Query('webhookEndpointId') webhookEndpointId?: string,
  ) {
    return this.webhooksService.listDeliveries(user, webhookEndpointId).then(ok);
  }

  @Post('deliveries/:deliveryId/retry')
  retryDelivery(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.webhooksService.retryDelivery(user, deliveryId).then(ok);
  }
}
