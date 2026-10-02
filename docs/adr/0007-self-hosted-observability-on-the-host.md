# 0007 — Run Jaeger, Prometheus and Alertmanager on the host instead of Grafana Cloud

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-02 |

## Context

PROJECT_PLAN lists Jaeger and Prometheus for local use and Grafana Cloud for production. US-36 needs a trace UI, and US-38 needs alerts on the 5xx rate, dead-letter queues and host memory/disk, with an "alert test" (NFR-MT-06). Constraints: one small host (A-32), cost near zero, everything in git (principle 5), and dev/prod parity (twelve-factor).

Grafana Cloud's free tier would work, but its alert rules, contact points and dashboards live in a web UI or a separate provisioning API, not in this repository. The nginx OpenTelemetry module can't authenticate to an external OTLP endpoint without a collector in between, and the account adds a credential and a dependency to set up before the first deploy.

## Options considered

1. **Grafana Cloud** (Alloy agent on the host shipping metrics and traces). Survives a host outage and has nicer dashboards. But it adds an account and a collector container, keeps alert definitions outside git, and works differently from local.
2. **Self-hosted on the host:** Jaeger (in-memory), Prometheus, Alertmanager and node-exporter in the same Compose stack. Identical locally and in production, rules versioned and unit-tested with `promtool`, no account. Costs about 450 MB of the host's memory and dies with the host.
3. **CloudWatch** (agent, metric filters, alarms). AWS-native and in Terraform, but it doesn't cover traces, and per-metric pricing adds up for per-route metrics.

## Decision

Option 2. The same `infra/monitoring` and `infra/jaeger` files run locally (`monitoring` profile) and in production, and alert rules are unit-tested in CI. Alerts are emailed through the SMTP provider the app already uses. An external uptime check (UptimeRobot on `/gateway/health`) covers the case the on-host stack can't: the host itself being down.

## Consequences

- One config for local and production; an alert rule can be tested on a laptop by breaking something and watching Mailpit.
- Traces are kept in memory (bounded by `JAEGER_MAX_TRACES`) and lost on restart. That's acceptable: they are for debugging recent requests, not records.
- The instance type moves from small to `t3.medium` (4 GiB) to fit the extra containers with headroom.
- Revisit when a second host appears (SCALING.md stage 2): monitoring should then live off the hosts it watches, and Grafana Cloud or a managed Prometheus becomes the better trade.
