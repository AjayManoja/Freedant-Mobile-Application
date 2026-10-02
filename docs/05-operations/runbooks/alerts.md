# Runbook: alerts

Every alert in [`infra/monitoring/alerts.yml`](../../../infra/monitoring/alerts.yml) links to its section here. Alerts arrive by email from Alertmanager (grouped; repeated every 4 h while firing; a RESOLVED mail follows). Commands assume a shell on the host ([DEPLOYMENT §5](../DEPLOYMENT.md#5-operating-the-host)) and this alias:

```bash
alias dc='docker compose -f /opt/feedants/current/infra/docker/compose.prod.yaml --env-file /opt/feedants/.env --env-file /opt/feedants/release.env'
```

To silence a known alert while you work: Alertmanager UI (port-forward 9093) → Silence.

## HighErrorRate

**Means:** more than 1 % of one service's requests returned 5xx, continuously for 5 minutes (NFR-MT-06). Users are seeing errors.

1. Which routes? Prometheus (port-forward 9090):
   `sum by (route, status_code) (rate(http_requests_total{service="<service>", status_code=~"5.."}[5m]))`
2. Why? `dc logs --since 15m <service> | grep '"level":50'`. Each line has a `traceId`; open it in Jaeger to see which dependency failed.
3. Just deployed? Roll back ([DEPLOYMENT §4](../DEPLOYMENT.md#4-rollback)) and investigate afterwards.
4. Dependency down (Postgres, Redis, RabbitMQ)? `dc ps`, then that container's logs. `HostMemoryLow` or `HostDiskLow` often fire alongside.
5. Payment `PAYMENT_PROVIDER_ERROR` bursts: check the Razorpay status page; orders retry and the reconciliation job catches up.

## ServiceDown

**Means:** Prometheus couldn't scrape a service for a minute: the process is down or wedged. The gateway answers 502 for its routes.

1. `dc ps <service>`: restarting? `dc logs --tail 100 <service>`. A config error at startup names the bad keys (never their values).
2. OOM-killed (`docker inspect <container> --format '{{.State.OOMKilled}}'`)? See [HostOomKill](#hostoomkill).
3. Restart: `dc up -d --no-deps <service>`. If it started failing after a deploy, roll back.

## DeadLetterQueueNotEmpty

**Means:** an event failed its handler on every retry (5 attempts, 5 s apart) and was parked in `<queue>.dlq`. The effect it should have had (confirm a registration, credit a prize, send a notification) **has not happened**.

1. Inspect it: RabbitMQ UI (port-forward 15672) → Queues → `<queue>.dlq` → Get messages. Headers: `x-error` (last error), `x-retries`, `traceparent`. Jaeger shows the failed attempts under that trace.
2. Find and fix the cause: a bug (deploy a fix), or a dependency that was down longer than the retries lasted.
3. Replay: move the messages back to the work queue (UI → `<queue>.dlq` → Move messages → destination `<queue>`), or with the shovel plugin. Handlers are idempotent (inbox table), so replaying an event that partly succeeded is safe.
4. A malformed message (`x-error: malformed`) can't succeed; record it in [DEBUGGING_LOG](../DEBUGGING_LOG.md) and purge it.

The alert resolves when the DLQ is empty.

## BrokerMetricsMissing

**Means:** RabbitMQ's metrics endpoint can't be scraped, so dead-letter alerts can't fire. Usually RabbitMQ itself is down; services then show `rabbitmq: down` in `/health/ready`, and outbox rows wait in Postgres until it returns (nothing is lost).

`dc ps rabbitmq`, `dc logs --tail 100 rabbitmq`, `dc up -d rabbitmq`.

## HostMemoryLow

**Means:** less than 10 % of memory available for 5 minutes. The next step is the kernel OOM-killing a container.

1. `docker stats --no-stream`: who is big? Each container has a memory limit (compose.prod.yaml); one at its limit is the suspect.
2. Short term: restart the offender (`dc restart <service>`).
3. Persistent: raise `instance_type` in Terraform (stop/start, a few minutes of downtime), or lower limits; record why.

## HostOomKill

**Means:** the kernel killed a process for lack of memory in the last 5 minutes. `journalctl -k | grep -i 'killed process'` names it. Then as [HostMemoryLow](#hostmemorylow). If it was Postgres, check `dc logs postgres` for recovery and run the smoke test.

## HostDiskLow

**Means:** the root filesystem is under 10 % free (`HostDiskFillingUp` warns earlier, when the trend would fill it within a day).

1. `df -h /`, `docker system df`.
2. Old images: `docker image prune -af --filter until=72h`. Container logs are capped at 5 × 10 MB each.
3. Prometheus is capped at 2 GB; Postgres growth is real data: grow the EBS volume (`root_volume_gb`, then `growpart` and `xfs_growfs /`).

## HostMetricsMissing

**Means:** node-exporter can't be scraped, so memory and disk alerts are blind. `dc up -d node-exporter`.

## BackupStale

**Means:** no successful database backup in 26 hours (RPO 24 h, NFR-RL-07), or none ever (`BackupNeverRan`).

1. `systemctl status feedants-backup.timer feedants-backup.service` and `journalctl -u feedants-backup --since -2d`.
2. Run it now: `systemctl start feedants-backup`, and watch the journal.
3. Typical causes: S3 permissions (the instance role writes to the backup bucket only), Postgres down, disk full.

## When the whole host is down

Prometheus and Alertmanager run on the host, so they go down with it; the UptimeRobot check on `/gateway/health` is what tells you. Check the instance in the EC2 console (status checks), reboot it, and if it is lost: rebuild with Terraform and restore the latest backup ([restore.md](restore.md)).
