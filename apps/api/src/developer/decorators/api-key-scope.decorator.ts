import { SetMetadata } from '@nestjs/common';

export const API_KEY_SCOPES_KEY = 'api_key_scopes';

export function RequireApiKeyScope(...scopes: string[]) {
  return SetMetadata(API_KEY_SCOPES_KEY, scopes);
}
