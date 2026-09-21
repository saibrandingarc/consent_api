import { Controller, Delete, Get, Param, Post, Body } from '@nestjs/common';
import { PERMISSIONS } from '@cmp/auth';
import { createApiKeySchema } from '@cmp/validation';
import type { CurrentUser } from '@cmp/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ok } from '../common/utils/response';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
@RequirePermissions(PERMISSIONS.API_KEY_MANAGE)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@CurrentUserDecorator() user: CurrentUser) {
    return this.apiKeysService.list(user).then(ok);
  }

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: unknown,
  ) {
    return this.apiKeysService
      .create(user, body as Parameters<ApiKeysService['create']>[1])
      .then(ok);
  }

  @Delete(':id')
  revoke(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user, id).then(ok);
  }
}
