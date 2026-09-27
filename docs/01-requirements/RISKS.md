# Risk Register

Reviewed at the end of every sprint. Likelihood (L) and impact (I) are scored 1 (low) to 3 (high); **score = L × I**. Risks scoring 6 or more get a named mitigation task on the board.

| ID | Risk | L | I | Score | Mitigation | Trigger / contingency |
|---|---|---|---|---|---|---|
| R-1 | **Scope creep.** Building Later features or polishing screens before the core loop works. | 3 | 3 | 9 | Frozen Must list ([SCOPE](SCOPE.md) change control); each sprint ends with a working demo of the loop | A sprint misses its demo → cut Should items from the next sprint |
| R-2 | **Timeline overrun.** One developer, part-time, 12 weeks. | 3 | 2 | 6 | Weekly sprint review against the plan; Must items first; buffer in Phase 4 | Two sprints late → drop Could items, move Should items to post-v1 |
| R-3 | **Distributed debugging is slow.** Failures spread across services and the message broker. | 2 | 3 | 6 | Tracing and request IDs built in Phase 2 (not Sprint 7); dead-letter queues; debugging log | A bug takes more than a day → add a trace or log where it was hard to see, and record it in the debugging log |
| R-4 | **Event consistency bugs** (lost, duplicate or out-of-order events). | 2 | 3 | 6 | Outbox, idempotent consumers, contract tests, failure-path tests in S4 | A failure test fails → fix before any new feature work |
| R-5 | **Payment correctness** (double charge, missed refund, ledger imbalance). | 2 | 3 | 6 | Server-set amounts, idempotency keys, signed webhooks, ledger sum-to-zero constraint, reconciliation job | Any ledger imbalance → stop the payment flow, investigate, post-mortem |
| R-6 | **Secret leaked in the public repo.** | 2 | 3 | 6 | gitleaks pre-commit and in CI, `.env` ignored, SSM for production, test-mode keys only | Leak detected → rotate the key immediately, purge history, post-mortem |
| R-7 | **EC2 host too small** (4 services + Postgres + Redis + RabbitMQ in ~2 GB). | 2 | 2 | 4 | Container memory limits, small base images, swap file, measure in Phase 4 | Out-of-memory events → move up one instance size or move Postgres to RDS |
| R-8 | **AWS cost overrun.** | 2 | 2 | 4 | Budget alarm in Terraform, stop the instance when not demoing, on-demand staging destroyed after use | Budget alert → review Cost Explorer, destroy idle resources |
| R-9 | **Regulatory exposure.** Paid-entry contests with cash prizes may be treated as real-money online games under India's 2025 regulation. | 1 | 3 | 3 | Test mode only (A-7); README disclaimer; no real users charged | Any move to real money → legal review first |
| R-10 | **Hosts never publish results**, leaving escrow and revenue locked. | 2 | 2 | 4 | Due date shown to the host; overdue list in My competitions | Occurs in testing → prioritise auto-cancel-and-refund (Later item) |
| R-11 | **Learning curve** for Expo, NestJS microservices and Terraform at the same time. | 3 | 2 | 6 | Foundation phase builds one "hello" path end to end before features; Terraform only in Phase 5 | A tool blocks progress more than 2 days → simplify (e.g. managed service) and record an ADR |
| R-12 | **Razorpay test-mode limits**, or webhooks can't reach the laptop. | 2 | 2 | 4 | cloudflared tunnel for local webhooks; payment adapter interface with a fake for tests | Razorpay unavailable → run against the fake provider and document it |
| R-13 | **Email OTP not delivered** (SES sandbox, spam filtering). | 2 | 2 | 4 | Mailpit locally; verified recipients or Resend in production; clear resend flow | Delivery failures → switch provider through config |
| R-14 | **Windows development friction** (line endings, Docker memory, file watching). | 2 | 1 | 2 | `.gitattributes` forces LF, Docker Desktop with WSL2, services run natively during development | Persistent issues → develop inside WSL2 |
| R-15 | **Dependency breakage** (major version changes across Expo, NestJS, Prisma). | 2 | 2 | 4 | Lockfile, pinned versions, Dependabot PRs one at a time with CI | A breaking upgrade → pin and schedule the upgrade as its own story |
| R-16 | **Data loss** on the single host. | 1 | 3 | 3 | Nightly backups to S3, restore drill (US-39), infrastructure reproducible with Terraform | Host lost → rebuild with Terraform and restore the latest backup |
| R-17 | **Design mismatch.** The rebuilt screens drift from the Figma reference. | 2 | 1 | 2 | Tokens imported from `design/tokens`, visual comparison against `design/reference` | Mismatch found in review → fix in the same sprint |

## Top risks

1. **R-1 Scope creep (9).** This is the most likely way the project fails. The core loop comes first, every sprint.
2. **R-2, R-3, R-4, R-5, R-6, R-11 (6).** These are mitigated by building tracing, tests and secret scanning early, before features rather than after.
