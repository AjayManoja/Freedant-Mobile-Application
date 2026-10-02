import { context, propagation, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import amqp from 'amqplib';
import { randomUUID } from 'node:crypto';
import { activeTraceIds, inSpan } from '../trace-context';
import { buildEvent } from './events';
import { RabbitEventBus } from './rabbit';

// Needs a real broker: runs in CI's messaging-integration job (RABBITMQ_URL set).
const url = process.env.RABBITMQ_URL;
const describeIfBroker = url ? describe : describe.skip;

const waitFor = async (check: () => boolean | Promise<boolean>, timeoutMs = 10_000) => {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
};

describeIfBroker('RabbitEventBus (real broker)', () => {
  let bus: RabbitEventBus;

  beforeAll(() => {
    bus = new RabbitEventBus({ url: url!, maxRetries: 2, retryDelayMs: 200 });
  });
  afterAll(() => bus.close());

  const userUpdated = () =>
    buildEvent('identity', 'user.updated', { userId: randomUUID(), displayName: 'Riya', avatarUrl: null });

  it('delivers published events to bound queues only', async () => {
    const queue = `test.${randomUUID()}`;
    const received: string[] = [];
    await bus.subscribe({
      queue,
      routingKeys: ['user.updated'],
      handler: async (e) => void received.push(e.id),
    });

    const wanted = userUpdated();
    await bus.publish(buildEvent('identity', 'user.deleted', { userId: randomUUID() }));
    await bus.publish(wanted);
    await waitFor(() => received.length === 1);
    await new Promise((r) => setTimeout(r, 300));
    expect(received).toEqual([wanted.id]);
  });

  it('retries a failing handler, then dead-letters it', async () => {
    const queue = `test.${randomUUID()}`;
    let attempts = 0;
    await bus.subscribe({
      queue,
      routingKeys: ['user.updated'],
      handler: async () => {
        attempts++;
        throw new Error('boom');
      },
    });
    const event = userUpdated();
    await bus.publish(event);

    await waitFor(() => attempts === 3); // first try + 2 retries
    const conn = await amqp.connect(url!);
    const ch = await conn.createChannel();
    let parked: amqp.GetMessage | false = false;
    await waitFor(async () => {
      parked = await ch.get(`${queue}.dlq`, { noAck: true });
      return parked !== false;
    });
    const msg = parked as unknown as amqp.GetMessage;
    expect(JSON.parse(msg.content.toString()).id).toBe(event.id);
    expect(msg.properties.headers?.['x-error']).toBe('boom');
    await conn.close();
  });

  it('recovers when a retry succeeds', async () => {
    const queue = `test.${randomUUID()}`;
    let attempts = 0;
    await bus.subscribe({
      queue,
      routingKeys: ['user.updated'],
      handler: async () => {
        attempts++;
        if (attempts === 1) throw new Error('transient');
      },
    });
    await bus.publish(userUpdated());
    await waitFor(() => attempts === 2);
  });

  it('continues the producer trace in the consumer (US-36)', async () => {
    const exporter = new InMemorySpanExporter();
    new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register();
    try {
      const queue = `test.${randomUUID()}`;
      let seen: { traceId: string; spanId: string } | undefined;
      await bus.subscribe({
        queue,
        routingKeys: ['user.deleted'], // a key no earlier (failing) test queue is bound to
        handler: async () => void (seen = activeTraceIds()),
      });
      // Built inside a request span, published later outside it, as the outbox relay does.
      const { event, traceId } = await inSpan('request', {}, async () => ({
        event: buildEvent('identity', 'user.deleted', { userId: randomUUID() }),
        traceId: activeTraceIds()!.traceId,
      }));
      await bus.publish(event);
      await waitFor(() => seen !== undefined);

      expect(seen!.traceId).toBe(traceId);
      const spans = exporter.getFinishedSpans();
      const publish = spans.find((s) => s.name === 'user.deleted publish')!;
      const consume = spans.find((s) => s.name === 'user.deleted process')!;
      expect(publish.spanContext().traceId).toBe(traceId);
      expect(consume.parentSpanContext?.spanId).toBe(publish.spanContext().spanId);
    } finally {
      trace.disable();
      context.disable();
      propagation.disable();
    }
  });
});
