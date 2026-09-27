# Infrastructure

| Folder | Contents | Phase |
|---|---|---|
| [`docker/`](docker/) | Docker Compose for local development and production (services, Postgres, Redis, RabbitMQ, MinIO, Mailpit, Jaeger) | 2 |
| [`nginx/`](nginx/) | API gateway: routing, TLS, rate limiting, blocking `/internal/*`, security headers | 2 |
| [`terraform/`](terraform/) | AWS: VPC, security groups, EC2, IAM role, S3, SSM Parameter Store, budget alarm. State in S3 with native locking. | 5 |

Rules:
- No secrets in this folder. Local secrets go in untracked `.env` files; production secrets live in AWS SSM Parameter Store.
- Only Nginx is reachable from the internet. Postgres, Redis and RabbitMQ sit on an internal Docker network with no published ports.
