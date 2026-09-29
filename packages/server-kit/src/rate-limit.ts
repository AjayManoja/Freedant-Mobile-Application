import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import type { AuthedRequest } from './auth';
import { AppError } from './errors';
import { REDIS } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in Redis (NFR-SC-03). Shared by every instance of a service, so
 * limits hold when a service runs as several containers (NFR-SL-01).
 */
@Injectable()
export class RateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async hit(name: string, subject: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSeconds);
    const key = `rl:${name}:${subject}:${windowStart}`;
    const [[, count]] = (await this.redis.multi().incr(key).expire(key, windowSeconds).exec()) as [
      [Error | null, number],
    ];
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: windowStart + windowSeconds - now,
    };
  }

  /** Throws RATE_LIMITED with Retry-After when the limit is exceeded. */
  async consume(name: string, subject: string, limit: number, windowSeconds: number): Promise<void> {
    const r = await this.hit(name, subject, limit, windowSeconds);
    if (!r.allowed) {
      throw new AppError(
        'RATE_LIMITED',
        'Too many requests, try again later',
        undefined,
        r.retryAfterSeconds,
      );
    }
  }
}

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
  /** Key requests by the signed-in user when present, otherwise by client IP. */
  by?: 'ip' | 'user';
}

const RATE_LIMIT = 'feedants:rate-limit';
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT, rule);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const rule = this.reflector.getAllAndOverride<RateLimitRule>(RATE_LIMIT, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!rule) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const subject = rule.by === 'user' && req.user ? `u:${req.user.id}` : `ip:${req.ip ?? 'unknown'}`;
    await this.limiter.consume(rule.name, subject, rule.limit, rule.windowSeconds);
    return true;
  }
}
