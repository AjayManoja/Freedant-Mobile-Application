import { Logger } from '@nestjs/common';
import type { EventEnvelope } from '@feedants/shared';
import type { EventBus } from './bus';

/** The slice of a Prisma client the relay and inbox need; works with any service's generated client. */
export interface SqlClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface TransactionalSqlClient extends SqlClient {
  $transaction<R>(
    fn: (tx: SqlClient) => Promise<R>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<R>;
}

interface OutboxRow {
  id: string;
  payload: EventEnvelope;
}

export interface OutboxRelayOptions {
  intervalMs: number;
  batchSize: number;
}

/**
 * Transactional-outbox relay (HLD §5.1). Rows are claimed with FOR UPDATE SKIP LOCKED, so
 * several instances of a service can relay concurrently without publishing a row twice
 * from the same poll; a crash between publish and commit republishes (at-least-once),
 * which consumers absorb through their inbox.
 */
export class OutboxRelay {
  private readonly logger = new Logger('OutboxRelay');
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = true;

  constructor(
    private readonly db: TransactionalSqlClient,
    private readonly bus: EventBus,
    private readonly options: OutboxRelayOptions,
  ) {}

  start(): void {
    this.stopped = false;
    this.schedule();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    while (this.running) await new Promise((r) => setTimeout(r, 20));
  }

  private schedule(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), this.options.intervalMs);
  }

  private async tick(): Promise<void> {
    this.running = true;
    try {
      // Keep draining while full batches come back, so a burst doesn't wait N intervals.
      while ((await this.relayBatch()) === this.options.batchSize && !this.stopped) {
        /* continue */
      }
    } catch (err) {
      this.logger.warn({ err }, 'Outbox relay batch failed; will retry');
    } finally {
      this.running = false;
      this.schedule();
    }
  }

  /** Publishes one batch; returns how many rows were published. */
  async relayBatch(): Promise<number> {
    if (!this.bus.isConnected()) return 0;
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRawUnsafe<OutboxRow[]>(
          `SELECT id, payload FROM outbox_events
            WHERE published_at IS NULL
            ORDER BY created_at, id
            LIMIT $1
            FOR UPDATE SKIP LOCKED`,
          this.options.batchSize,
        );
        if (rows.length === 0) return 0;
        for (const row of rows) await this.bus.publish(row.payload);
        await tx.$executeRawUnsafe(
          `UPDATE outbox_events SET published_at = now() WHERE id = ANY($1::uuid[])`,
          rows.map((r) => r.id),
        );
        return rows.length;
      },
      { timeout: 30_000 },
    );
  }
}

/**
 * Idempotent-consumer guard (HLD §5.2). Call inside the transaction that applies the
 * event's side effects: returns false when this consumer already processed the event,
 * in which case the caller skips the work and the message is acked.
 */
export async function claimInbox(tx: SqlClient, eventId: string, consumer: string): Promise<boolean> {
  const inserted = await tx.$executeRawUnsafe(
    `INSERT INTO inbox_events (event_id, consumer_name, processed_at)
     VALUES ($1::uuid, $2, now())
     ON CONFLICT DO NOTHING`,
    eventId,
    consumer,
  );
  return inserted === 1;
}
