# LLD — Notification service

| | |
|---|---|
| **Owns** | In-app notifications, later push and realtime ([PROJECT_PLAN.md](../../PROJECT_PLAN.md)) |
| **Database** | `notification_db` — see [ERD §5](../ERD.md#5-notification-service--notification_db) |
| **API** | [API.md §5](../API.md#5-notification-service) |
| **Events** | [EVENTS.md §6](../EVENTS.md#6-notification-service) |

Deliberately the simplest service: a pure event consumer with a read API, no outbox, no writes that any other service depends on. Its downtime never blocks join, pay or submit (PROJECT_PLAN) — the queues it hasn't drained just grow, and it catches up on restart (NFR-RL-04, US-32).

## 1. Event → notification mapping (FR-NT-01)

| Consumed event | `notifications.type` | Recipient(s) | Title/body template inputs |
|---|---|---|---|
| `registration.confirmed` | `REGISTRATION_CONFIRMED` | `creatorId` | competition title |
| `payment.failed` | `PAYMENT_FAILED` | looked up via the order's registration — see note below | reason |
| `payment.refunded` | `REFUND_ISSUED` | `creatorId` | amount, reason |
| `competition.published` | `COMPETITION_PUBLISHED` | `hostId` | competition title |
| `competition.registration_opened` | `REGISTRATION_OPENED` | every ID in `subscriberUserIds` | competition title |
| `competition.cancelled` | — (reuses `REFUND_ISSUED` once the matching `payment.refunded` lands; no separate row from this event) | — | — |
| `competition.results_published` | `RESULTS_PUBLISHED` for everyone in `allRegistrationCreatorIds`; additionally `PRIZE_WON` for everyone in `winners[]` | both lists | competition title; `PRIZE_WON` also carries rank + amount |

Note on `payment.failed`: the event payload ([EVENTS.md](../EVENTS.md#paymentfailed)) carries `idempotencyKey`, not `creatorId` directly — the consumer resolves the recipient by calling `GET /v1/registrations?idempotencyKey=` on Competition. This is the one place Notification reaches outside its own event stream; documented here so it isn't mistaken for a missed "self-contained payload" rule elsewhere (§7 of [EVENTS.md](../EVENTS.md#7-schema-evolution-rule) governs event payloads, not this lookup). Flagged for Phase 1 review — the alternative (Competition embedding `creatorId` directly in a re-published notification-ready event) may be preferred once implemented, and would remove this exception entirely.

## 2. Handler shape

One queue (`notification.all`, [EVENTS.md §2](../EVENTS.md#2-exchange-and-queue-topology)), one consumer entry point dispatching on `type`:

```
on message(envelope):
  if inbox_events has envelope.id for consumer 'notification': ack, return
  BEGIN
    for each recipient implied by envelope.data (per §1 table):
      INSERT notifications(user_id, type, title, body, data)
    INSERT inbox_events(envelope.id, 'notification')
  COMMIT
  ack
```

A single event can fan out to many rows (`competition.registration_opened` to every subscriber, `competition.results_published` to every participant) — the fan-out and the inbox marker commit together, so a crash mid-fan-out is retried whole, not half-delivered.

## 3. Read API behaviour

- `GET /v1/notifications` — newest-first, cursor-paginated on `created_at DESC, id`.
- `GET /v1/notifications/unread-count` — `SELECT count(*) WHERE user_id = :id AND read_at IS NULL`, backed by the partial index in [ERD §5](../ERD.md#5-notification-service--notification_db); cheap enough at A-31 scale (10k users) to compute live rather than maintain a counter column.
- `POST /v1/notifications/{id}/read`, `POST /v1/notifications/read-all` — ownership-checked (`user_id` must match the token), sets `read_at = now()`.
- Tapping a notification (FR-NT-03) is a client-side concern: `data` carries a deep-link target (`{ "competitionId": "...", "registrationId": "..." }`) the app routes on; Notification itself has no opinion on app navigation.

## 4. Health

- `GET /health/live`, `GET /health/ready` (Postgres, RabbitMQ) — NFR-MT-05.
