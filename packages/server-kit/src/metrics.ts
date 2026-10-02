import { Controller, Get, Header } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
import { Public } from './auth';

/**
 * Prometheus metrics (US-38, NFR-MT-06). Scraped on the internal network at `/metrics`; the
 * gateway never routes it. The alert rules in infra/monitoring use `http_requests_total` for
 * the 5xx-rate alert and `http_request_duration_seconds` for latency.
 */
export const metricsRegistry = new Registry();

const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'HTTP requests handled, by route template and status code',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by route template',
  labelNames: ['method', 'route'] as const,
  buckets: [0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

let defaultsStarted = false;

/** Labels every series with the service name and starts process metrics (memory, event loop). */
export function initMetrics(serviceName: string): void {
  metricsRegistry.setDefaultLabels({ service: serviceName });
  if (defaultsStarted) return;
  defaultsStarted = true;
  collectDefaultMetrics({ register: metricsRegistry });
}

const UNMEASURED = /^\/(health|metrics)(\/|$)/;

/**
 * Express middleware recording each request once it finishes. The route label is the matched
 * template (`/v1/competitions/:id`), never the raw URL, so IDs can't explode cardinality.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (UNMEASURED.test(req.path)) return next();
  const end = httpDuration.startTimer();
  res.once('finish', () => {
    const route = (req.route as { path?: string } | undefined)?.path;
    // No route, or Nest's catch-all 404 route (`{/*splat}`), counts as unmatched.
    const matched = route && !route.includes('*') ? `${req.baseUrl}${route}` : 'unmatched';
    const labels = { method: req.method, route: matched };
    end(labels);
    httpRequests.inc({ ...labels, status_code: String(res.statusCode) });
  });
  next();
}

@Public()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', metricsRegistry.contentType)
  metrics(): Promise<string> {
    return metricsRegistry.metrics();
  }
}
