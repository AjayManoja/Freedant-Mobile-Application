import type { EventEnvelope } from '@feedants/shared';

export type EventHandler = (event: EventEnvelope) => Promise<void>;

export interface SubscribeOptions {
  /** Durable queue name, `<service>.<concern>` (EVENTS.md §2). */
  queue: string;
  routingKeys: string[];
  handler: EventHandler;
  prefetch?: number;
}

/**
 * Transport-neutral event bus. Services depend on this, never on amqplib directly, so the
 * transport can change (SCALING.md stage 5) without touching service code.
 */
export abstract class EventBus {
  abstract publish(event: EventEnvelope): Promise<void>;
  abstract subscribe(options: SubscribeOptions): Promise<void>;
  abstract isConnected(): boolean;
}

/** Synchronous in-process bus for tests: records publishes and delivers to matching subscribers. */
export class InMemoryEventBus extends EventBus {
  readonly published: EventEnvelope[] = [];
  private readonly subscribers: SubscribeOptions[] = [];
  /** When false, published events are recorded but not delivered until `deliverAll()`. */
  autoDeliver = false;

  async publish(event: EventEnvelope): Promise<void> {
    this.published.push(event);
    if (this.autoDeliver) await this.deliver(event);
  }

  async subscribe(options: SubscribeOptions): Promise<void> {
    this.subscribers.push(options);
  }

  isConnected(): boolean {
    return true;
  }

  async deliver(event: EventEnvelope): Promise<void> {
    for (const s of this.subscribers) {
      if (s.routingKeys.some((k) => matches(k, event.type))) await s.handler(event);
    }
  }

  async deliverAll(): Promise<void> {
    for (const e of this.published.splice(0)) await this.deliver(e);
  }

  ofType(type: string): EventEnvelope[] {
    return this.published.filter((e) => e.type === type);
  }
}

/** AMQP topic matching: `*` matches one word, `#` matches zero or more. */
export function matches(pattern: string, key: string): boolean {
  const p = pattern.split('.');
  const k = key.split('.');
  const walk = (i: number, j: number): boolean => {
    if (i === p.length) return j === k.length;
    if (p[i] === '#') return walk(i + 1, j) || (j < k.length && walk(i, j + 1));
    if (j === k.length) return false;
    return (p[i] === '*' || p[i] === k[j]) && walk(i + 1, j + 1);
  };
  return walk(0, 0);
}
