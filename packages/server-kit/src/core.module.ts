import {
  type DynamicModule,
  Global,
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
  type Provider,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import type { Redis } from 'ioredis';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import { AuthGuard, type AuthedRequest, TokenVerifier } from './auth';
import { AllExceptionsFilter } from './errors';
import { HealthController, HealthRegistry } from './health';
import { ensureRequestId } from './http';
import { RateLimitGuard, RateLimiter } from './rate-limit';
import { createRedis, REDIS } from './redis';

export interface CoreModuleOptions {
  serviceName: string;
  logLevel: string;
  redisUrl: string;
  /**
   * How access tokens are verified. Other services pass a JwksTokenVerifier here; Identity
   * omits it and provides its own local verifier in its app module.
   */
  tokenVerifier?: Provider;
}

/** Paths never written to logs: tokens, OTP codes and personal data (NFR-SC-07). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.email',
  '*.code',
  '*.otp',
  '*.accessToken',
  '*.refreshToken',
  '*.token',
  '*.password',
  '*.secret',
  'email',
  'code',
  'token',
];

@Injectable()
class RedisLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly health: HealthRegistry,
  ) {}

  onModuleInit(): void {
    this.health.register('redis', () => this.redis.ping());
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

@Global()
@Module({})
export class CoreModule {
  static forRoot(options: CoreModuleOptions): DynamicModule {
    return {
      module: CoreModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: options.logLevel,
            base: { service: options.serviceName },
            genReqId: (req: IncomingMessage, res: ServerResponse) =>
              ensureRequestId(req as Request, res as unknown as Response),
            customProps: (req: IncomingMessage) => ({ userId: (req as AuthedRequest).user?.id }),
            redact: { paths: REDACT_PATHS, censor: '[redacted]' },
            serializers: {
              req: (req: { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
            autoLogging: { ignore: (req: IncomingMessage) => req.url?.startsWith('/health') ?? false },
          },
        }),
      ],
      controllers: [HealthController],
      providers: [
        { provide: REDIS, useFactory: () => createRedis(options.redisUrl) },
        RedisLifecycle,
        HealthRegistry,
        RateLimiter,
        ...(options.tokenVerifier ? [options.tokenVerifier] : []),
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        // Order matters: authentication first, so rate limits can key on the user.
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard },
      ],
      exports: [REDIS, HealthRegistry, RateLimiter, ...(options.tokenVerifier ? [TokenVerifier] : [])],
    };
  }
}
