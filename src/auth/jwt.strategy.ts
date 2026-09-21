import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { AUTH_ERROR_CODES } from '@cmp/auth';
import { JWT_CONFIG } from '@cmp/config';
import type { Auth0TokenClaims, CurrentUser } from '@cmp/types';
import { Auth0ConfigService } from './auth0-config.service';
import { AuthService } from './auth.service';

interface CmpJwtPayload {
  sub: string;
  email: string;
  type: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly auth0Mode: boolean;
  private readonly auth0Audience: string;

  constructor(
    private readonly auth0Config: Auth0ConfigService,
    private readonly authService: AuthService,
  ) {
    const config = auth0Config.getConfig();
    const auth0Mode = config.configured;
    const jwksProvider = auth0Mode
      ? passportJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 10,
          jwksUri: `https://${config.domain}/.well-known/jwks.json`,
        })
      : null;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'RS256'],
      secretOrKeyProvider: (request, rawJwtToken, done) => {
        const decoded = jwt.decode(rawJwtToken, { complete: true });
        if (!decoded || typeof decoded === 'string') {
          done(new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid token' }));
          return;
        }

        if (decoded.header.alg === 'HS256') {
          done(null, JWT_CONFIG.accessSecret());
          return;
        }

        if (!jwksProvider) {
          done(
            new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid token type' }),
          );
          return;
        }

        jwksProvider(request, rawJwtToken, done);
      },
    });

    this.auth0Mode = auth0Mode;
    this.auth0Audience = config.audience;
  }

  async validate(payload: Auth0TokenClaims | CmpJwtPayload): Promise<CurrentUser> {
    const cmpPayload = payload as CmpJwtPayload;
    if (cmpPayload.type === 'access') {
      return this.authService.getCurrentUser(cmpPayload.sub);
    }

    if (!payload?.sub) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.TOKEN_INVALID,
        message: 'Authentication required.',
      });
    }

    if (this.auth0Mode && this.auth0Audience) {
      const aud = (payload as jwt.JwtPayload).aud;
      const audiences = Array.isArray(aud) ? aud : aud ? [aud] : [];
      if (!audiences.includes(this.auth0Audience)) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.TOKEN_INVALID,
          message: 'Invalid token audience.',
        });
      }
    }

    return this.authService.ensureFromAuth0Claims(payload as Auth0TokenClaims);
  }
}
