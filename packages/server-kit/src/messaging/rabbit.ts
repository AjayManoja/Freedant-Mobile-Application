import { Logger } from '@nestjs/common';
import { EVENT_EXCHANGE, type EventEnvelope, eventEnvelopeSchema } from '@feedants/shared';
import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage, Options } from 'amqplib';
import { requestContext } from '../context';
import { EventBus, type SubscribeOptions } from './bus';

export interface RabbitBusOptions {
  url: string;
  maxRetries: number;
  retryDelayMs: number;
  publishTimeoutMs?: number;
}

const RETRY_HEADER = 'x-retries';

/**
 * RabbitMQ topic-exchange bus (EVENTS.md §2). Each queue gets a delayed retry queue and a
 * dead-letter queue: a failing message is retried `maxRetries` times, `retryDelayMs` apart,
 * then parked in `<queue>.dlq` for inspection and replay instead of blocking the queue.
 */
export class RabbitEventBus extends EventBus {
  private readonly logger = new Logger('RabbitEventBus');
  private readonly connection: AmqpConnectionManager;
  private readonly publisher: ChannelWrapper;
  private readonly consumers: ChannelWrapper[] = [];

  constructor(private readonly options: RabbitBusOptions) {
    super();
    this.connection = amqp.connect([options.url], { heartbeatIntervalInSeconds: 15 });
    this.connection.on('connect', () => this.logger.log('Connected to RabbitMQ'));
    this.connection.on('disconnect', ({ err }) => this.logger.warn({ err }, 'Disconnected from RabbitMQ'));
    this.publisher = this.connection.createChannel({
      json: false,
      publishTimeout: options.publishTimeoutMs ?? 10_000,
      setup: (ch: ConfirmChannel) => ch.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true }),
    });
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  async publish(event: EventEnvelope): Promise<void> {
    await this.publisher.publish(EVENT_EXCHANGE, event.type, Buffer.from(JSON.stringify(event)), {
      persistent: true,
      contentType: 'application/json',
      messageId: event.id,
      type: event.type,
      headers: event.traceId ? { 'x-trace-id': event.traceId } : {},
    });
  }

  async subscribe({ queue, routingKeys, handler, prefetch = 10 }: SubscribeOptions): Promise<void> {
    const retryQueue = `${queue}.retry`;
    const deadLetterQueue = `${queue}.dlq`;
    const channel = this.connection.createChannel({
      json: false,
      setup: async (ch: ConfirmChannel) => {
        await ch.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
        await ch.assertQueue(queue, { durable: true });
        await ch.assertQueue(retryQueue, {
          durable: true,
          arguments: {
            'x-message-ttl': this.options.retryDelayMs,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': queue,
          },
        });
        await ch.assertQueue(deadLetterQueue, { durable: true });
        for (const key of routingKeys) await ch.bindQueue(queue, EVENT_EXCHANGE, key);
        await ch.prefetch(prefetch);
        await ch.consume(queue, (msg) => {
          if (msg) void this.onMessage(ch, msg, queue, handler);
        });
      },
    });
    this.consumers.push(channel);
    await channel.waitForConnect();
  }

  private async onMessage(
    ch: ConfirmChannel,
    msg: ConsumeMessage,
    queue: string,
    handler: SubscribeOptions['handler'],
  ): Promise<void> {
    let event: EventEnvelope;
    try {
      event = eventEnvelopeSchema.parse(JSON.parse(msg.content.toString('utf8'))) as EventEnvelope;
    } catch (err) {
      this.logger.error({ err, queue }, 'Malformed message; dead-lettering');
      await this.send(ch, `${queue}.dlq`, msg, { 'x-error': 'malformed' });
      ch.ack(msg);
      return;
    }

    try {
      await requestContext.run({ requestId: event.traceId ?? event.id }, () => handler(event));
      ch.ack(msg);
    } catch (err) {
      const retries = Number(msg.properties.headers?.[RETRY_HEADER] ?? 0);
      const exhausted = retries >= this.options.maxRetries;
      this.logger.warn(
        { err, queue, eventId: event.id, eventType: event.type, retries },
        exhausted ? 'Handler failed; retries exhausted, dead-lettering' : 'Handler failed; scheduling retry',
      );
      try {
        if (exhausted) {
          await this.send(ch, `${queue}.dlq`, msg, {
            'x-error': err instanceof Error ? err.message.slice(0, 500) : 'unknown',
          });
        } else {
          await this.send(ch, `${queue}.retry`, msg, { [RETRY_HEADER]: retries + 1 });
        }
        ch.ack(msg);
      } catch (sendErr) {
        // Could not park the message: return it to the queue rather than lose it.
        this.logger.error({ err: sendErr, queue }, 'Failed to schedule retry; requeueing');
        ch.nack(msg, false, true);
      }
    }
  }

  private send(ch: ConfirmChannel, queue: string, msg: ConsumeMessage, headers: Record<string, unknown>) {
    const options: Options.Publish = {
      ...msg.properties,
      persistent: true,
      headers: { ...msg.properties.headers, ...headers },
    };
    return new Promise<void>((resolve, reject) =>
      ch.sendToQueue(queue, msg.content, options, (err) => (err ? reject(err) : resolve())),
    );
  }

  async close(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.close()));
    await this.publisher.close();
    await this.connection.close();
  }
}
