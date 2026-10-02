# Infrastructure

| Folder | Contents | Phase |
|---|---|---|
| [`docker/`](docker/) | `compose.yaml` for local development (services, Postgres, Redis, RabbitMQ, object storage, Mailpit, Jaeger, optional monitoring); `compose.prod.yaml` for the production host; the one service Dockerfile | 2, 5 |
| [`nginx/`](nginx/) | API gateway: routing, TLS (production), rate limiting, blocking `/internal/*`, security headers, OpenTelemetry spans. `http.conf` and `routes.conf` are shared by `nginx.conf` (local) and `nginx.prod.conf` | 2, 5 |
| [`jaeger/`](jaeger/) | Jaeger v2 config: OTLP in, traces in memory (US-36) | S7 |
| [`monitoring/`](monitoring/) | Prometheus scrape config, alert rules and their `promtool` unit tests, Alertmanager configs (US-38) | 5 |
| [`host/`](host/) | Scripts that run on the production host: deploy with rollback, smoke test, backup, restore, certificate renewal, and their systemd timers (US-37, US-39) | 5 |
| [`terraform/`](terraform/) | AWS: VPC, security group, EC2 host, IAM roles (host and GitHub OIDC deploy), S3 media and backup buckets, SSM parameters, budget alarm. State in S3 with native locking | 5 |

How it all fits together, first-time setup and day-to-day operation: [docs/05-operations/DEPLOYMENT.md](../docs/05-operations/DEPLOYMENT.md).

Rules:

- No secrets in this folder. Local secrets go in untracked `.env` files; production secrets live in AWS SSM Parameter Store.
- Only Nginx is reachable from the internet. Postgres, Redis and RabbitMQ sit on an internal Docker network with no published ports.
