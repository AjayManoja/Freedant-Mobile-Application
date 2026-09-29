import { outboxRecord } from '@feedants/server-kit';
import type { EventPayload, EventType } from '@feedants/shared';
import type { Prisma } from './generated/prisma/client';

/** Outbox row for `tx.outboxEvent.create`, written in the same transaction as the change. */
export function outbox<T extends EventType>(
  type: T,
  aggregate: { type: string; id: string },
  data: EventPayload<T>,
): Prisma.OutboxEventCreateInput {
  const record = outboxRecord('competition', type, aggregate, data);
  return { ...record, payload: record.payload as unknown as Prisma.InputJsonValue };
}
