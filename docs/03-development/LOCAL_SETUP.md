# Local Setup

From a fresh clone to a running stack in about 10 minutes (US-34).

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 LTS (see `.nvmrc`) | |
| pnpm | 10.x | `npm install -g pnpm@10` (or `corepack enable`) |
| Docker Desktop, or Docker Engine in WSL 2 | current | Windows: Desktop with the WSL 2 backend and ≥ 4 GB RAM (R-14), or Engine installed inside an Ubuntu WSL distro with `systemd=true` in `/etc/wsl.conf`; run the `docker compose` commands from that distro (ports reach Windows on `localhost`) |
| gitleaks | optional | Enables the secret scan in the pre-commit hook; CI always runs it |

Unit and integration tests **do not need Docker**: they run against an embedded PostgreSQL that `pnpm test` starts and stops itself (ADR 0003).

## 2. Install

```bash
pnpm install
```

This also installs the git hooks (Husky): Prettier on staged files, a gitleaks scan, and Conventional Commit message checks.

## 3. Run the tests

```bash
pnpm test          # every package and service (turbo, cached)
pnpm typecheck
pnpm lint
```

To run one service: `pnpm --filter @feedants/identity test`.

## 4. Start the infrastructure

```bash
cp infra/docker/.env.example infra/docker/.env
docker compose -f infra/docker/compose.yaml up -d
```

| URL | What |
|---|---|
| `localhost:5432` | PostgreSQL — one database and one login per service |
| `localhost:6379` | Redis |
| `http://localhost:15672` | RabbitMQ management (user/password from `.env`) — inspect and replay dead-letter queues |
| `http://localhost:8025` | Mailpit — sign-in codes land here |
| `http://localhost:9001` | Object storage console (RustFS, S3-compatible) |
| `http://localhost:16686` | Jaeger — one trace per request across the gateway, services and RabbitMQ (US-36) |

Alerting is optional locally; it runs the production alert rules, and alert emails land in Mailpit:

```bash
docker compose -f infra/docker/compose.yaml --profile app --profile monitoring up -d
```

| URL | What |
|---|---|
| `http://localhost:9090` | Prometheus — targets, rules, `http_requests_total` |
| `http://localhost:9093` | Alertmanager — firing and silenced alerts |

`BackupNeverRan` goes pending locally (there is no nightly backup); ignore it or silence it.

## 5. Run the services

Either everything in containers behind the gateway:

```bash
docker compose -f infra/docker/compose.yaml --profile app up -d --build
# API: http://localhost:8080/v1/...
```

Each service waits for a one-shot `<service>-migrate` job that applies its migrations first.

Then load the demo data (people and competitions from the Figma prototype, in every phase):

```bash
for s in identity competition payment notification; do
  docker compose -f infra/docker/compose.yaml --profile app run --rm --no-deps "$s" node dist/seed.js
done
```

Sign in as **`riya@example.com`** (the code arrives in Mailpit). She has a draft entry to finish, entries in review, a win with the prize in her wallet, a competition waiting for her to judge, a draft to publish and unread notifications. Seeding is idempotent and never overwrites existing competitions; to start over, `docker compose -f infra/docker/compose.yaml --profile app down -v` and seed again. Timelines are relative to when you seed, so phases move on as days pass. The dataset lives in [`packages/seed-data`](../../packages/seed-data/src/dataset.ts).

Or run one service on the host with hot reload (faster when working on it):

```bash
cd services/identity
cp .env.example .env
pnpm db:migrate
pnpm dev
```

## 6. Changing a database schema

1. Edit `services/<service>/prisma/schema.prisma`.
2. Generate the SQL for the change:
   `pnpm --filter @feedants/<service> db:migration > prisma/migrations/<timestamp>_<name>/migration.sql`
3. Review the SQL. Add anything Prisma cannot express (partial indexes, check constraints, triggers) by hand.
4. Keep it backward compatible: **expand → migrate → contract** — never drop or rename a column the running version still reads.

## 7. Mobile app

See [apps/mobile/README.md](../../apps/mobile/README.md). The app talks to the gateway at `EXPO_PUBLIC_API_URL`; on a physical phone use your machine's LAN IP instead of `localhost`.

## 8. Production secrets

Production settings and secrets live in SSM Parameter Store under `/feedants/<environment>/`, never in git. After the first `terraform apply`, `infra/terraform/scripts/generate-secrets.sh` fills the generated ones (database and broker passwords, internal token, OTP pepper, the RS256 signing key); provider credentials are set by hand. See [DEPLOYMENT.md](../05-operations/DEPLOYMENT.md).

## Troubleshooting

Real problems and their fixes are logged in [DEBUGGING_LOG.md](../05-operations/DEBUGGING_LOG.md).
