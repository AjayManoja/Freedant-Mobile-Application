import {
  type Attributes,
  type Context,
  context,
  type Link,
  propagation,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

/**
 * Trace-context helpers (NFR-MT-04, US-36). They use only the OpenTelemetry API, which is a
 * no-op until `startTracing` (./tracing) registers the SDK, so they are safe in tests and in
 * any process that runs without an exporter.
 */

const tracer = () => trace.getTracer('@feedants/server-kit');

/** W3C `traceparent` of the active span, carried in event envelopes and stored with orders. */
export function currentTraceparent(): string | undefined {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier.traceparent;
}

/** Context whose parent is the given `traceparent`; the root context when there is none. */
export function contextFromTraceparent(traceparent: string | undefined): Context {
  return traceparent ? propagation.extract(ROOT_CONTEXT, { traceparent }) : ROOT_CONTEXT;
}

/** IDs of the active span, merged into every log line so logs and traces line up. */
export function activeTraceIds(): { traceId: string; spanId: string } | undefined {
  const sc = trace.getActiveSpan()?.spanContext();
  return sc && trace.isSpanContextValid(sc) ? { traceId: sc.traceId, spanId: sc.spanId } : undefined;
}

/** A link to the active span, for work that continues another trace (e.g. a webhook). */
export function activeSpanLink(): Link[] {
  const sc = trace.getActiveSpan()?.spanContext();
  return sc && trace.isSpanContextValid(sc) ? [{ context: sc }] : [];
}

export interface SpanOptions {
  kind?: SpanKind;
  attributes?: Attributes;
  /** Parent context; defaults to the active one. */
  parent?: Context;
  links?: Link[];
}

/** Runs `fn` inside a new active span, recording a thrown error and always ending the span. */
export async function inSpan<T>(
  name: string,
  options: SpanOptions,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = tracer().startSpan(
    name,
    { kind: options.kind ?? SpanKind.INTERNAL, attributes: options.attributes, links: options.links },
    options.parent ?? context.active(),
  );
  try {
    return await context.with(trace.setSpan(options.parent ?? context.active(), span), () => fn(span));
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
    throw err;
  } finally {
    span.end();
  }
}

export { SpanKind };
