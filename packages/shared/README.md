# Shared package

Code every service and the mobile app reuse, so rules are defined once.

- **Config:** typed environment config validated with zod at startup (fail fast)
- **Logging:** pino logger with `service`, `requestId`, `traceId` fields and PII redaction
- **Errors:** one error response format for all services
- **Event contracts:** versioned zod schemas (e.g. `payment.captured.v1`) used by both publishers and consumers
- **Messaging:** transactional outbox relay and idempotent-consumer helper
- **Validation:** request schemas shared with the mobile app's forms

Scaffolded in Phase 2 (Foundation).
