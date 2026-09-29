# 0003 — Run integration tests against an embedded PostgreSQL instead of Testcontainers

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-28 |

## Context

The plan names Testcontainers for integration tests. Testcontainers needs a Docker daemon on every machine that runs tests. The development machine is Windows, where Docker Desktop is heavy and was not installed at the start (R-14), and the concurrency guarantees we must prove (no overbooking, single-use codes, token rotation races) need a **real** PostgreSQL, not a mock.

## Options considered

1. **Testcontainers** — faithful, but tests can't run without Docker.
2. **pg-mem / SQLite** — fast, but they don't implement row locking, `FOR UPDATE SKIP LOCKED` or partial indexes the way PostgreSQL does, which are exactly what the tests must prove.
3. **embedded-postgres** — downloads real PostgreSQL 18 binaries as an npm dependency and runs them as a child process.

## Decision

Option 3. A Jest `globalSetup` (`@feedants/testing`) starts one PostgreSQL per test run on a free port; each test file creates its own database and applies the service's migrations; `globalTeardown` stops the server. Redis is replaced by `ioredis-mock`, RabbitMQ by `InMemoryEventBus`. The real RabbitMQ adapter is tested separately in CI against a broker service container.

## Consequences

- `pnpm test` works on any machine with Node — no Docker needed — and in CI unchanged.
- Tests exercise the real migrations, constraints and locking behaviour.
- Redis-specific behaviour is only as faithful as `ioredis-mock`; anything subtle (Lua scripts, cluster) needs a real-Redis test in CI.
- Revisit if we need other containers in tests (then Testcontainers pays for itself).
