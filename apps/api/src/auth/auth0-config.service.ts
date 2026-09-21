import { Injectable } from '@nestjs/common';

export interface Auth0RuntimeConfig {
  configured: boolean;
  domain: string;
  audience: string;
  issuer: string;
}

@Injectable()
export class Auth0ConfigService {
  getConfig(): Auth0RuntimeConfig {
    const domain = (process.env.AUTH0_DOMAIN ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const audience = process.env.AUTH0_AUDIENCE ?? '';
    const issuer =
      process.env.AUTH0_ISSUER_BASE_URL?.replace(/\/$/, '') ||
      process.env.AUTH0_ISSUER_URL?.replace(/\/$/, '') ||
      (domain ? `https://${domain}` : '');

    return {
      configured: Boolean(domain && audience && issuer),
      domain,
      audience,
      issuer: issuer.endsWith('/') ? issuer : `${issuer}/`,
    };
  }
}
