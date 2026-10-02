import { z } from 'zod';

/** Envelope shared by every event (docs/02-design/EVENTS.md §1). */
export const eventEnvelopeSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  occurredAt: z.iso.datetime(),
  producer: z.enum(['identity', 'competition', 'payment']),
  /** Request ID of the originating HTTP request, for log correlation. */
  traceId: z.string().optional(),
  /** W3C trace context of the span that produced the event, so consumers join its trace (US-36). */
  traceparent: z.string().optional(),
  data: z.unknown(),
});
export type EventEnvelope<T = unknown> = Omit<z.infer<typeof eventEnvelopeSchema>, 'data'> & { data: T };

const id = z.uuid();
const paise = z.number().int().nonnegative();

/**
 * Payload schemas keyed by routing key. Consumers ignore unknown fields (EVENTS.md §7),
 * so these are non-strict objects; producers are type-checked against them.
 */
export const eventSchemas = {
  // Identity
  'user.created': z.object({ userId: id, createdAt: z.iso.datetime() }),
  'user.updated': z.object({
    userId: id,
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  'user.deleted': z.object({ userId: id }),

  // Competition
  'competition.published': z.object({ competitionId: id, hostId: id, title: z.string() }),
  'competition.registration_opened': z.object({
    competitionId: id,
    title: z.string(),
    subscriberUserIds: z.array(id),
  }),
  'competition.cancelled': z.object({
    competitionId: id,
    hostId: id,
    title: z.string(),
    confirmedRegistrations: z.array(z.object({ registrationId: id, creatorId: id, orderId: id.nullable() })),
  }),
  'competition.results_published': z.object({
    competitionId: id,
    hostId: id,
    title: z.string(),
    winners: z.array(
      z.object({ rank: z.number().int().positive(), registrationId: id, creatorId: id, amountPaise: paise }),
    ),
    unawardedAmountPaise: paise,
    hostRevenuePaise: paise,
    allRegistrationCreatorIds: z.array(id),
  }),
  /** Funding was captured for a competition that can no longer be published; Payment refunds it. */
  'competition.funding_rejected': z.object({ competitionId: id, hostId: id, orderId: id }),
  'registration.held': z.object({
    registrationId: id,
    competitionId: id,
    creatorId: id,
    holdExpiresAt: z.iso.datetime(),
  }),
  'registration.confirmed': z.object({
    registrationId: id,
    competitionId: id,
    competitionTitle: z.string(),
    creatorId: id,
  }),
  'registration.expired': z.object({ registrationId: id, competitionId: id }),
  'registration.rejected': z.object({
    registrationId: id,
    competitionId: id,
    creatorId: id,
    orderId: id,
  }),
  'submission.submitted': z.object({ submissionId: id, competitionId: id, creatorId: id }),

  // Payment
  'payment.captured': z.object({
    orderId: id,
    competitionId: id,
    idempotencyKey: z.string(),
    purpose: z.enum(['ENTRY_FEE', 'PRIZE_FUNDING']),
    referenceId: id,
    payerId: id,
    amountPaise: paise,
  }),
  'payment.failed': z.object({
    orderId: id,
    competitionId: id,
    idempotencyKey: z.string(),
    purpose: z.enum(['ENTRY_FEE', 'PRIZE_FUNDING']),
    referenceId: id,
    payerId: id,
    reason: z.string(),
  }),
  'payment.refunded': z.object({
    refundId: id,
    orderId: id,
    competitionId: id,
    payerId: id,
    amountPaise: paise,
    reason: z.enum(['CANCELLATION', 'LATE_CAPTURE_REJECTED', 'FUNDING_REJECTED']),
  }),
} as const;

export type EventType = keyof typeof eventSchemas;
export type EventPayload<T extends EventType> = z.infer<(typeof eventSchemas)[T]>;

export const EVENT_EXCHANGE = 'feedants.events';
