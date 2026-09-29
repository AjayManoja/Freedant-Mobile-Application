# 0002 — Pin mature major versions of the toolchain

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-28 |

## Context

At the start of development (September 2026) several core tools had brand-new majors: TypeScript 7 (native compiler), NestJS 12 (one month old), Prisma 8 (release candidate), ioredis 6, amqplib 2, ESLint 10, pnpm 12. R-15 (dependency breakage) and R-11 (learning curve) both argue against building on versions the ecosystem hasn't caught up with — NestJS relies on `emitDecoratorMetadata`, and plugins lag new majors.

## Decision

Use the newest major that has been stable for several months and is still maintained:

| Tool | Version | Instead of |
|---|---|---|
| TypeScript | 5.9 | 7.0 |
| NestJS | 11.x | 12.x |
| Prisma | 7.x (driver adapters, `prisma-client` generator) | 8 RC |
| ioredis | 5.x | 6.0 |
| amqplib | 0.10.x | 2.x |
| ESLint | 9.x | 10.x |
| pnpm | 10.x | 12.x |
| Expo SDK | 57 | — (current) |

## Consequences

- Fewer surprises from plugins and type definitions.
- Each skipped major becomes its own upgrade story later, one at a time, with CI as the safety net; Dependabot is configured to ignore majors so they don't arrive unplanned.
- Revisit when a skipped major has been out ~6 months or a security fix requires it.
