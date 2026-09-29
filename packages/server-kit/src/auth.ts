import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { requestContext } from './context';
import { AppError } from './errors';

export interface AuthUser {
  id: string;
  /** Refresh-token family the access token was issued from (one per device sign-in). */
  sessionId?: string;
}

export type AuthedRequest = Request & { user?: AuthUser };

/** Verifies an access token. Services verify locally against Identity's JWKS (no call per request). */
export abstract class TokenVerifier {
  abstract verify(token: string): Promise<AuthUser>;
}

export interface JwtVerifyOptions {
  issuer: string;
  audience: string;
}

export async function verifyAccessToken(
  token: string,
  keys: JWTVerifyGetKey,
  opts: JwtVerifyOptions,
): Promise<AuthUser> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: opts.issuer,
      audience: opts.audience,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string') throw new Error('missing sub');
    return { id: payload.sub, sessionId: typeof payload.sid === 'string' ? payload.sid : undefined };
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Invalid or expired access token');
  }
}

export class JwksTokenVerifier extends TokenVerifier {
  private readonly keys: JWTVerifyGetKey;

  constructor(
    jwksUrl: string,
    private readonly opts: JwtVerifyOptions,
  ) {
    super();
    // jose caches keys and refetches on an unknown `kid`, which covers key rotation.
    this.keys = createRemoteJWKSet(new URL(jwksUrl), { cacheMaxAge: 10 * 60_000, cooldownDuration: 30_000 });
  }

  verify(token: string): Promise<AuthUser> {
    return verifyAccessToken(token, this.keys, this.opts);
  }
}

const AUTH_MODE = 'feedants:auth-mode';
type AuthMode = 'required' | 'optional' | 'public';

/** No token needed and none is read (health, JWKS, webhooks). */
export const Public = () => SetMetadata(AUTH_MODE, 'public' satisfies AuthMode);
/** Guests allowed; a valid token, when present, identifies the viewer (e.g. competition detail). */
export const OptionalAuth = () => SetMetadata(AUTH_MODE, 'optional' satisfies AuthMode);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new AppError('UNAUTHENTICATED', 'Sign in required');
  return user;
});

export const MaybeUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);

const bearer = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
};

/**
 * Global guard: every route requires a valid token unless marked @Public or @OptionalAuth.
 * The verifier is looked up across the whole app, so a service can provide its own
 * (Identity signs and verifies locally) without CoreModule depending on it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private cachedVerifier?: TokenVerifier;

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  private get verifier(): TokenVerifier {
    this.cachedVerifier ??= this.moduleRef.get(TokenVerifier, { strict: false });
    return this.cachedVerifier;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const mode =
      this.reflector.getAllAndOverride<AuthMode>(AUTH_MODE, [ctx.getHandler(), ctx.getClass()]) ?? 'required';
    if (mode === 'public') return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = bearer(req);
    if (!token) {
      if (mode === 'optional') return true;
      throw new AppError('UNAUTHENTICATED', 'Sign in required');
    }
    req.user = await this.verifier.verify(token);
    requestContext.setUser(req.user.id);
    return true;
  }
}
