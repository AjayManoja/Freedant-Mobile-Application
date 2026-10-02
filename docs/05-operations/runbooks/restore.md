# Runbook: restore the databases from a backup

| | |
|---|---|
| **Story** | US-39 · NFR-RL-07: RPO ≤ 24 h, RTO ≤ 1 h, proven by a drill |
| **Scripts** | [`backup.sh`](../../../infra/host/backup.sh) · [`restore.sh`](../../../infra/host/restore.sh) |

## What is backed up

Every night at 02:00 IST (`feedants-backup.timer`), `backup.sh` dumps the four service databases with `pg_dump` (custom format), plus the role list without passwords, and uploads them with a `SHA256SUMS` file to `s3://<backup bucket>/postgres/<UTC timestamp>/`. The bucket is versioned and private, the host's role can add backups but not delete them, and backups expire after `backup_retention_days` (30).

Not backed up, by design: **Redis** (cache, rate-limit counters, OTP codes, all rebuildable or short-lived), **RabbitMQ** (events are in each service's outbox table until published; consumers are idempotent), **Jaeger and Prometheus** (diagnostics), **S3 media** (already durable in S3).

The four dumps are taken one after another, seconds apart, not at one instant. An event in flight between two of them can be missing on one side after a restore. The outbox republishes anything unpublished in the restored producer, inboxes ignore duplicates, and Payment's reconciliation job compares orders with the provider. Check the dead-letter queues afterwards (step 7).

## When to use it

- Data was destroyed or corrupted (bad migration, operator error) → restore on the same host.
- The host is gone → rebuild it, then restore (section B).

Before restoring over live data, take a fresh backup so the restore itself can be undone: `systemctl start feedants-backup`.

## A. Restore on the running host

1. Open a shell: `aws ssm start-session --target <instance-id>`, then `sudo -i`.
2. Pick the backup: `aws s3 ls s3://$(grep BACKUP_BUCKET /opt/feedants/host.env | cut -d= -f2)/postgres/` (newest last). Choose the last one **before** the damage.
3. Silence alerts for 30 minutes (Alertmanager → Silence, `alertname=~".+"`); services stop during the restore.
4. Run, and start a timer:

   ```bash
   time /opt/feedants/current/infra/host/restore.sh 20261003T203012Z    # or: latest
   ```

   It downloads and verifies checksums, asks you to type `restore`, stops the four services (the gateway answers 502 meanwhile), recreates each database exactly as the init script does, restores it in a single transaction, starts the services and waits until each is ready. It stops at the first error; services stay stopped so nothing writes to a half-restored database. Fix the cause and run it again.
5. Smoke test: `/opt/feedants/current/infra/host/smoke.sh https://<domain> 127.0.0.1`.
6. Sign in on the app and open the wallet: the balance comes straight from the ledger.
7. Check the dead-letter queues (RabbitMQ UI, port 15672): handlers can fail on events about data that the restore rolled back. Replay or purge them as in [alerts.md](alerts.md#deadletterqueuenotempty).
8. Remove the silence and record the restore in the table below (it counts as a drill).

## B. The host is lost

1. `terraform apply` creates a new host (the old one's EBS volume, if it still exists, holds the last state; prefer it over a backup when it is readable).
2. Run the **Deploy** workflow for the last good SHA. On an empty volume, Postgres's init script creates the four databases and roles with the passwords in SSM.
3. Restore as in section A, from step 4 (`restore.sh latest`).
4. Point DNS at the new Elastic IP if it changed (Route 53 does this on apply).

Budget for section B: ~10 minutes of Terraform and bootstrap, ~10 minutes of deploy, then the restore itself. That is well inside the 1-hour RTO at the current data size.

## Drill record

A drill restores a real backup into a running stack, checks that the data matches and the system works, and times it. Do one after any change to the backup or restore scripts, and at least once a quarter.

| Date | Environment | Backup | Simulated loss | Restore time | Result | By |
|---|---|---|---|---|---|---|
| 2026-10-02 | Local stack (Docker, WSL) with the demo seed: 33 users, 108 registrations, 94 orders, 272 ledger entries | 4 s, 131 KB (4 dumps + roles) | `notifications` table dropped; `users` and `registrations` truncated (cascading to refresh tokens and submissions) | **18 s** (download, checksum, recreate, restore, services ready) | ✅ Row counts identical before and after for 8 tables; ledger still sums to 0; smoke test passed | AjayManoja |

The local drill exercised the same scripts with `BACKUP_DEST` pointing at a local folder instead of S3. The first production drill should repeat it against S3 on the real host once it exists.
