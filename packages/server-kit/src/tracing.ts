import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/** Paths that are polled constantly and would drown real traces. */
const UNTRACED = /^\/(health|metrics)(\/|$)/;

/**
 * Starts OpenTelemetry tracing (US-36). Import this module before anything else in a
 * service's entry point — through `src/tracing.ts` — because instrumentation only patches
 * modules (http, express, pg, ioredis) loaded after it.
 *
 * Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set, so tests and bare `node` runs export nothing.
 * Standard OTel variables apply: OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS,
 * OTEL_SDK_DISABLED, and OTEL_TRACES_SAMPLER_ARG (sampling ratio for new traces, default 1).
 *
 * HTTP context crosses services in `traceparent` headers; events carry it in their envelope
 * and AMQP headers (RabbitEventBus). Database and Redis spans are only recorded inside a
 * traced request or message, so pollers (outbox relay, sweeps) don't produce orphan traces.
 */
export function startTracing(serviceName: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_SDK_DISABLED === 'true') return false;

  const ratio = Number(env.OTEL_TRACES_SAMPLER_ARG ?? '1');
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: env.SERVICE_VERSION ?? 'dev',
      'deployment.environment.name': env.NODE_ENV ?? 'development',
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(Number.isFinite(ratio) ? ratio : 1),
    }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  });
  // Registers the AsyncLocalStorage context manager and the W3C trace-context propagator.
  provider.register();

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => UNTRACED.test(req.url ?? ''),
      }),
      new ExpressInstrumentation({
        // Nest's catch-all middleware layers (`{/*splat}`) still show up as request-handler spans;
        // ignoring them corrupts http.route (their path is never popped), so they stay.
        ignoreLayersType: [ExpressLayerType.MIDDLEWARE, ExpressLayerType.ROUTER],
      }),
      new UndiciInstrumentation(),
      new PgInstrumentation({ requireParentSpan: true }),
      new IORedisInstrumentation({ requireParentSpan: true }),
    ],
  });

  // Flush buffered spans on shutdown; `once` so Nest's own shutdown hook still ends the process.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => void provider.shutdown().catch(() => undefined));
  }
  return true;
}
