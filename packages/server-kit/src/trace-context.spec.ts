import { context, propagation, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { buildEvent } from './messaging/events';
import { activeTraceIds, contextFromTraceparent, currentTraceparent, inSpan } from './trace-context';

describe('trace context', () => {
  const exporter = new InMemorySpanExporter();

  beforeAll(() => {
    new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register();
  });
  afterEach(() => exporter.reset());
  afterAll(() => {
    trace.disable();
    context.disable();
    propagation.disable();
  });

  const event = () =>
    buildEvent('identity', 'user.updated', {
      userId: '0190d1a2-0000-7000-8000-000000000001',
      displayName: 'Riya',
      avatarUrl: null,
    });

  it('has no trace context outside a span', () => {
    expect(currentTraceparent()).toBeUndefined();
    expect(activeTraceIds()).toBeUndefined();
    expect(event().traceparent).toBeUndefined();
  });

  it('stamps events with the producing span, so consumers continue its trace', async () => {
    const built = await inSpan('POST /v1/competitions/:id/join', {}, async () => ({
      ids: activeTraceIds()!,
      event: event(),
    }));
    expect(built.event.traceparent).toBe(`00-${built.ids.traceId}-${built.ids.spanId}-01`);

    // What the relay and the consumer do with that envelope later, on another tick.
    await inSpan('publish', { parent: contextFromTraceparent(built.event.traceparent) }, async () => {
      await inSpan('process', {}, async () => undefined);
    });
    const [publish, process] = ['publish', 'process'].map((n) =>
      exporter.getFinishedSpans().find((s) => s.name === n)!,
    );
    expect(publish!.spanContext().traceId).toBe(built.ids.traceId);
    expect(publish!.parentSpanContext?.spanId).toBe(built.ids.spanId);
    expect(process!.spanContext().traceId).toBe(built.ids.traceId);
    expect(process!.parentSpanContext?.spanId).toBe(publish!.spanContext().spanId);
  });

  it('records a failure on the span and rethrows', async () => {
    await expect(
      inSpan('fails', {}, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const [span] = exporter.getFinishedSpans();
    expect(span!.status).toMatchObject({ code: 2, message: 'boom' });
    expect(span!.events.map((e) => e.name)).toContain('exception');
  });
});
