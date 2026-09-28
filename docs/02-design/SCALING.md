# Scaling Path

| | |
|---|---|
| **Version** | 1.0 (Phase 1) |
| **Status** | Draft for review |
| **Related** | [PROJECT_PLAN.md](../PROJECT_PLAN.md#scaling-path) (summary table this expands) · [HLD](HLD.md) · [Assumption A-31/A-32](../01-requirements/ASSUMPTIONS.md) |

Every step below is triggered by a **measured signal**, never a guess (PROJECT_PLAN principle 4: "scale by configuration, not rewrite"). The MVP is sized for A-31's target — 10k registered users, 500 concurrently active, ~1k open competitions, read:write ≈ 20:1 — and every step assumes the stateless-service, event-driven, one-database-per-service design in [HLD.md](HLD.md) holds; none of these steps change a service boundary or a data-ownership rule.

## 1. Why this is possible without a rewrite

Three design choices, already baked into Phase 1, are what make every row below "configuration or infrastructure" instead of "redesign":

1. **Services are stateless** (NFR-SL-01) — no in-memory session, no sticky routing requirement. Running two copies of Competition behind a load balancer is not a different program, just a different process count.
2. **Communication is events by default** (HLD §2) — adding a consumer (e.g. OpenSearch indexing) never touches the producer. The producer doesn't know or care who's listening.
3. **Each service owns its data** (NFR-SL-02) — a database can be moved to a managed service, read-replicated, or resharded one service at a time, because nothing else ever queried it directly.

## 2. Stages

### Stage 0 — MVP (current design)

| | |
|---|---|
| Infra | 1 EC2 host, Docker Compose, all four services + Postgres + Redis + RabbitMQ |
| Capacity | Sized for A-31 |
| Known ceiling | Single host CPU/memory (R-7); single point of failure (A-32) |

### Stage 1 — ~100k users, or DB CPU > 60%, or managed backups needed

| | |
|---|---|
| Signal | DB CPU sustained > 60% (CloudWatch), or backup/restore drills (NFR-RL-07) become the bottleneck rather than a scheduled job |
| Change | Move Postgres to RDS (Multi-AZ optional), Redis to ElastiCache, static assets/media fronted by CloudFront |
| Code impact | **None** — connection strings move from Compose service names to RDS/ElastiCache endpoints via env vars (`@nestjs/config`, already zod-validated at startup per NFR-MT-03); no query or schema change |
| Terraform | New `aws_db_instance`, `aws_elasticache_cluster`, `aws_cloudfront_distribution` resources; app containers' env vars point at their outputs |

### Stage 2 — App CPU > 70%, more traffic than one host serves comfortably

| | |
|---|---|
| Signal | App container CPU sustained > 70%, or p95 latency (NFR-PF-01) starts drifting under real load |
| Change | Application Load Balancer + 2+ EC2 hosts running the same Compose stack (or split into one host per service group) |
| Code impact | **None** — statelessness (NFR-SL-01) is what's being spent here; no session affinity to configure, no in-memory cache to invalidate cross-instance because caching already lives in Redis, not process memory (PROJECT_PLAN caching table) |
| Terraform | Auto Scaling Group or a second `aws_instance`, target group, listener rules |

### Stage 3 — ~1M users, services need independent scaling

| | |
|---|---|
| Signal | Services show divergent load (e.g. Competition's read traffic scales faster than Payment's), justifying independent instance counts rather than scaling everything together |
| Change | ECS Fargate with per-service autoscaling policies; PgBouncer in front of each service's Postgres for connection pooling (NFR-PF target: "no connection exhaustion" from PROJECT_PLAN's performance table); read replicas for read-heavy services (Competition, Identity) |
| Code impact | **Terraform only** — task definitions replace Compose services; application code already treats its DB connection as config, already has no server-affinity assumptions |
| Note | This is the point where "4 services + gateway" (PROJECT_PLAN) starts paying for itself: each service's autoscaling policy is tuned to its own traffic shape instead of one blunt instance count |

### Stage 4 — Search p95 > 300 ms (A-19's own revisit trigger)

| | |
|---|---|
| Signal | Search p95 exceeds 300 ms, or Explore/Search needs multi-language or fuzzy ranking beyond `pg_trgm` |
| Change | OpenSearch, fed by a **new consumer** subscribed to `competition.*` events (`competition.published`, and a `competition.updated` the schema evolution rule in [EVENTS.md §7](EVENTS.md#7-schema-evolution-rule) allows adding without touching Competition's producer code) |
| Code impact | New consumer service/module only; `GET /v1/search` swaps its query implementation behind the same route contract in [API.md](API.md#discovery-guest); Competition's write path is untouched — it was already emitting the events this consumer needs |

### Stage 5 — Event volume: replay needed, or > 10k events/s

| | |
|---|---|
| Signal | A debugging/audit need requires replaying historical events (RabbitMQ doesn't retain), or sustained throughput exceeds what a topic exchange + durable queues handle comfortably |
| Change | Kafka, introduced behind the **shared messaging package** every service already imports for outbox publish / inbox consume ([HLD §5.1–5.2](HLD.md#5-consistency-patterns)) |
| Code impact | **Messaging package only** — because every producer/consumer already goes through one internal abstraction (publish an outbox row, consume with inbox dedupe) rather than calling `amqplib` directly, swapping the transport is isolated to that package's implementation |

### Stage 6 — Competition service too large (divergent change rate or scale)

| | |
|---|---|
| Signal | Media/submissions and core competition/registration logic start changing for unrelated reasons, or need different scaling profiles (large media traffic vs. transactional registration traffic) |
| Change | Extract a Media/Submissions service, owning `submissions` and upload orchestration, publishing `submission.*` events Competition (still owning judging/results) consumes back |
| Code impact | Planned, contained — `submissions` already has clean foreign keys only to `registrations`/`competitions` (no entangled joins elsewhere in [ERD.md](ERD.md#3-competition-service--competition_db)), and the event-driven boundary already exists in principle (`submission.submitted` is already an outbox event in [EVENTS.md](EVENTS.md#submissionsubmitted)) — the extraction moves a table and a module, it doesn't invent a new integration pattern |

## 3. What never changes across all six stages

- The four-service boundary and what each owns (PROJECT_PLAN "Communication rule").
- The outbox/inbox consistency pattern ([HLD §5](HLD.md#5-consistency-patterns)) — every stage above scales the transport or the compute under it, never the guarantee it provides.
- The API contract in [API.md](API.md) — clients (the mobile app) never see any of this; a stage transition is invisible above the gateway.
- "No hard-coded values" (PROJECT_PLAN) — every stage's new infra target arrives via env var / Terraform variable, consistent with how Stage 0 was already built (NFR-MT-03).

## 4. Explicitly deferred until a stage triggers it

Matches PROJECT_PLAN's "later, only when a measured signal requires it" list: RDS, ElastiCache, CloudFront (Stage 1); ECS Fargate, PgBouncer (Stage 3); OpenSearch (Stage 4); Kafka (Stage 5). None of these are provisioned, evaluated in CI, or referenced by application code at MVP — introducing them early would violate PROJECT_PLAN principle 2 ("every tool earns its place") for a signal that doesn't yet exist.
