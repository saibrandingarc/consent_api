import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { AUTH0_CONFIG } from '@cmp/config';

export interface Auth0Profile {
  sub: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

@Injectable()
export class Auth0Service {
  private readonly jwks = AUTH0_CONFIG.enabled
    ? jwksClient({
        jwksUri: `https://${AUTH0_CONFIG.domain}/.well-known/jwks.json`,
        cache: true,
        rateLimit: true,
      })
    : null;

  async verifyIdToken(idToken: string): Promise<Auth0Profile> {
    if (!AUTH0_CONFIG.enabled || !this.jwks) {
      throw new BadRequestException({
        code: 'AUTH0_NOT_CONFIGURED',
        message: 'Auth0 is not configured on the server',
      });
    }

    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Invalid Auth0 token',
      });
    }

    const signingKey = await this.getSigningKey(decoded.header.kid);
    const payload = jwt.verify(idToken, signingKey, {
      issuer: AUTH0_CONFIG.issuerUrl,
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;

    const clientId = AUTH0_CONFIG.clientId;
    const aud = payload.aud;
    const audiences = Array.isArray(aud) ? aud : aud ? [aud] : [];
    const authorizedParty = typeof payload.azp === 'string' ? payload.azp : undefined;
    if (
      clientId &&
      !audiences.includes(clientId) &&
      authorizedParty !== clientId
    ) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Auth0 token audience does not match this application',
      });
    }

    const email = typeof payload.email === 'string' ? payload.email : undefined;
    if (!payload.sub || !email) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Auth0 token is missing required claims',
      });
    }

    const { firstName, lastName } = this.splitName(payload);

    return {
      sub: payload.sub,
      email: email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      firstName,
      lastName,
    };
  }

  private splitName(payload: jwt.JwtPayload): { firstName: string; lastName: string } {
    if (typeof payload.given_name === 'string' || typeof payload.family_name === 'string') {
      return {
        firstName: (payload.given_name as string | undefined) ?? 'User',
        lastName: (payload.family_name as string | undefined) ?? '',
      };
    }

    const fullName = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!fullName) {
      return { firstName: 'User', lastName: '' };
    }

    const parts = fullName.split(/\s+/);
    return {
      firstName: parts[0] ?? 'User',
      lastName: parts.slice(1).join(' '),
    };
  }

  private getSigningKey(kid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.jwks!.getSigningKey(kid, (error, key) => {
        if (error || !key) {
          reject(error ?? new Error('Signing key not found'));
          return;
        }
        resolve(key.getPublicKey());
      });
    });
  }
}
