import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ApiKeyContext } from '../guards/api-key.guard';

export const ApiKeyContextDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const request = ctx.switchToHttp().getRequest<{ apiKeyContext: ApiKeyContext }>();
    return request.apiKeyContext;
  },
);
