import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { requestContext } from './context';
import { metricsMiddleware } from './metrics';

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;
type WithRequestId = Request & { requestId?: string };

/**
 * One request ID per request: the gateway's X-Request-Id when well-formed, otherwise new.
 * Echoed back so clients can quote it in bug reports (NFR-MT-04).
 */
export function ensureRequestId(req: Request, res: Response): string {
  const r = req as WithRequestId;
  if (r.requestId) return r.requestId;
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  r.requestId = id;
  res.setHeader('X-Request-Id', id);
  return id;
}

export interface HttpOptions {
  trustProxy: string;
  corsOrigins: string[];
  jsonLimit?: string;
}

/** Shared HTTP setup, used by `main.ts` and by e2e tests so both exercise the same stack. */
export function configureHttp(app: INestApplication, options: HttpOptions): void {
  const express = app as NestExpressApplication;
  express.useLogger(app.get(Logger));
  express.set('trust proxy', options.trustProxy);
  express.disable('x-powered-by');
  // Must run before anything else so every downstream log line and event sees the context.
  express.use((req: Request, res: Response, next: NextFunction) =>
    requestContext.run({ requestId: ensureRequestId(req, res) }, next),
  );
  express.use(metricsMiddleware);
  express.use(helmet());
  express.useBodyParser('json', { limit: options.jsonLimit ?? '100kb' });
  express.enableCors({
    origin: options.corsOrigins.length > 0 ? options.corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });
  express.enableShutdownHooks();
}
