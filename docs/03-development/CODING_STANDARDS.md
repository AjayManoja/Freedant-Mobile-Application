# Coding Standards

Rules that code review enforces. Tooling enforces what it can (TypeScript strict, ESLint, Prettier); the rest is here.

## Layout

| Where | What |
|---|---|
| `packages/shared` | Framework-free rules, zod schemas and event contracts used by services **and** the mobile app. No Node or NestJS imports. |
| `packages/server-kit` | NestJS building blocks: config, logging, errors, auth guard, rate limits, health, storage, outbox/inbox, event bus. |
| `packages/testing` | Test-only helpers (embedded PostgreSQL). |
| `services/<name>/src/<feature>/` | One folder per feature: `*.controller.ts` (HTTP only), `*.service.ts` (domain logic, transactions), consumers. |
| `services/<name>/test/` | Integration tests against a real database, named after the user stories they prove. |

## Rules

1. **Money is integer paise** (`number` holding an integer, `BIGINT` in Postgres). Never floats, never formatted strings in storage (A-6). Format only in the UI with `formatInr`.
2. **Time is UTC** (`timestamptz`). Durations and countdowns are computed, never stored as strings.
3. **No magic numbers.** Business rules come from `defaultRules` (shared) overridden by validated env config. Infra values come from env or Terraform variables.
4. **Validate at the edge.** Every request body/query goes through `ZodPipe` with a strict schema from `@feedants/shared` (unknown fields rejected). Code behind the controller trusts its inputs.
5. **Authorise every resource.** The user ID comes from the verified token (`@CurrentUser()`), never from the body. Every read or write of a user-owned resource checks ownership in the query (`where: { id, hostId: user.id }`) — OWASP API #1.
6. **One error format.** Throw `AppError(code, message)` with a code from `ErrorCodes`; never `throw new Error` for expected failures, never return error objects.
7. **Events go through the outbox.** A state change that other services must learn about writes its outbox row **in the same transaction** (`tx.outboxEvent.create({ data: outbox(...) })`). Never publish to the bus directly from request code.
8. **Consumers are idempotent.** Every handler calls `claimInbox(tx, event.id, consumer)` inside the transaction that applies the side effect, and returns early when it was already processed.
9. **Concurrency by construction.** Scarce resources (spots, one-time codes, token rotation) are claimed with conditional writes (`UPDATE … WHERE spots_remaining > 0`, `updateMany({ where: { revokedAt: null } })`) and the affected-row count is checked. Never read-then-write.
10. **Synchronous calls have timeouts.** The only cross-service HTTP call (Competition → Payment order creation) uses a fixed timeout and fails fast.
11. **Logs are structured and PII-free.** Use the Nest `Logger` with an object first (`logger.warn({ orderId }, 'message')`). Never log emails, codes, tokens or request bodies; the logger redacts common keys as a backstop.
12. **Comments explain why, not what.** Link the requirement ID (`FR-PT-02`, `A-11`) when a rule comes from the SRS or assumptions.

## Tests

- Domain rules (money, prize split, lifecycle, ledger) aim for ≥ 80 % line coverage (NFR-MT-02).
- Integration tests use a real PostgreSQL (embedded, started by Jest) and in-memory doubles for Redis (`ioredis-mock`), the event bus (`InMemoryEventBus`), storage (`InMemoryObjectStorage`) and email.
- Name test blocks after the user story or requirement they prove (`US-22 never overbook the last spot`).
- Concurrency claims get a concurrency test (e.g. 50 parallel joins for 1 spot).

## TypeScript

- `strict`, `noUncheckedIndexedAccess`. No `any`; `unknown` plus parsing instead.
- In NestJS services, import constructor-injected classes as values (not `import type`) — DI reads their runtime metadata.
