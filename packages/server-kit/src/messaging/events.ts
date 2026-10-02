import { type EventEnvelope, type EventPayload, eventSchemas, type EventType } from '@feedants/shared';
import { requestContext } from '../context';
import { AppError } from '../errors';
import { uuidv7 } from '../ids';
import { currentTraceparent } from '../trace-context';

export type Producer = EventEnvelope['producer'];

/**
 * Builds a validated envelope. The request ID and trace context come from the current request
 * or consumed event, so the event continues that trace when the outbox relays it later.
 */
export function buildEvent<T extends EventType>(
  producer: Producer,
  type: T,
  data: EventPayload<T>,
): EventEnvelope<EventPayload<T>> {
  const parsed = eventSchemas[type].parse(data) as EventPayload<T>;
  return {
    id: uuidv7(),
    type,
    occurredAt: new Date().toISOString(),
    producer,
    traceId: requestContext.get()?.requestId,
    traceparent: currentTraceparent(),
    data: parsed,
  };
}

/** Row for a service's `outbox_events` table (ERD §1), written in the same transaction as the change. */
export interface OutboxRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: EventEnvelope;
}

export function outboxRecord<T extends EventType>(
  producer: Producer,
  type: T,
  aggregate: { type: string; id: string },
  data: EventPayload<T>,
): OutboxRecord {
  const event = buildEvent(producer, type, data);
  return {
    id: event.id,
    aggregateType: aggregate.type,
    aggregateId: aggregate.id,
    eventType: type,
    payload: event as EventEnvelope,
  };
}

/** Parses a consumed event's payload against its contract; unknown fields are kept but ignored. */
export function parseEvent<T extends EventType>(event: EventEnvelope, type: T): EventPayload<T> {
  if (event.type !== type) {
    throw new AppError('INTERNAL', `Expected ${type} but received ${event.type}`);
  }
  return eventSchemas[type].parse(event.data) as EventPayload<T>;
}

export const isEventType = (type: string): type is EventType => type in eventSchemas;
