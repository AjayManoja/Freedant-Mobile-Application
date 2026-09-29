# 0001 — Split shared code into `shared` and `server-kit`; prefer small in-house helpers over Nest add-on packages

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-28 |

## Context

The plan lists one shared package and several NestJS add-ons (nestjs-zod, @nestjs/terminus, @nestjs/throttler, @golevelup/nestjs-rabbitmq). The mobile app must reuse validation schemas and money rules, but must not pull NestJS or Node-only code into the React Native bundle. Each add-on also brings its own conventions, and some need Redis or broker adapters of their own.

## Options considered

1. **One shared package** — simplest, but mixes isomorphic and Node-only code; Metro would try to bundle Nest.
2. **Two packages + add-ons** — clean split, but four more dependencies whose job is 20–80 lines each here.
3. **Two packages + small helpers** — `@feedants/shared` (zod schemas, rules, event contracts; no runtime dependencies beyond zod) and `@feedants/server-kit` (config, logging, errors, auth guard, rate limiter, health, storage, outbox/inbox, event bus).

## Decision

Option 3. `ZodPipe`, `HealthRegistry`, `RateLimiter` (Redis fixed window) and `RabbitEventBus` (amqplib + amqp-connection-manager) are written in server-kit, each under ~150 lines and covered by tests.

## Consequences

- The mobile app imports the exact schemas and rules the API enforces (e.g. `computePrizeTiers` for the wizard preview).
- Services depend on an `EventBus` abstraction, so replacing RabbitMQ (SCALING.md stage 5) touches one file.
- We own these helpers; if one grows beyond ~200 lines or needs features we'd reimplement, switch to the established package and supersede this ADR.
