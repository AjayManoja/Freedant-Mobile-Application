#!/usr/bin/env bash
# Logical backup of every service database (US-39, NFR-RL-07: RPO ≤ 24 h). Run nightly by
# feedants-backup.timer; also run it by hand before risky work.
#
#   backup.sh                        # → s3://$BACKUP_BUCKET/postgres/<UTC timestamp>/
#   BACKUP_DEST=/tmp/backups backup.sh   # → a local directory (local restore drills)
#
# Each database is dumped with pg_dump's custom format (compressed, restorable selectively),
# plus the role list without passwords and a SHA256SUMS file that restore.sh verifies.
# The host's IAM role may write backups but not delete them; the bucket's lifecycle rule
# expires old ones (infra/terraform/storage.tf).
set -euo pipefail

here=$(dirname "$(readlink -f "$0")")
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$here/lib.sh"
load_host_env

dest=${BACKUP_DEST:-s3://${BACKUP_BUCKET:?BACKUP_BUCKET is not set}/postgres}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
started=$(date +%s)

for db in "${DATABASES[@]}"; do
  log "Dumping $db"
  compose exec -T postgres pg_dump -U postgres --format=custom --compress=6 "$db" >"$work/$db.dump"
done
# Roles only, for reference: passwords come from SSM and the init script recreates the roles.
compose exec -T postgres pg_dumpall -U postgres --globals-only --no-role-passwords >"$work/globals.sql"
(cd "$work" && sha256sum -- *.dump globals.sql >SHA256SUMS)

if [[ $dest == s3://* ]]; then
  aws s3 cp --recursive --only-show-errors "$work" "$dest/$stamp/"
else
  mkdir -p "$dest/$stamp"
  cp "$work"/* "$dest/$stamp/"
fi

bytes=$(du -sb "$work" | cut -f1)
log "Backup $stamp written to $dest/$stamp ($bytes bytes, $(($(date +%s) - started)) s)"

# For the BackupStale alert, through node-exporter's textfile collector (written atomically).
metrics_dir=$FEEDANTS_HOME/metrics
if [[ -d $metrics_dir ]]; then
  cat >"$metrics_dir/backup.prom.tmp" <<EOF
# HELP feedants_backup_last_success_timestamp_seconds Unix time of the last successful database backup.
# TYPE feedants_backup_last_success_timestamp_seconds gauge
feedants_backup_last_success_timestamp_seconds $(date +%s)
# HELP feedants_backup_size_bytes Size of the last successful database backup.
# TYPE feedants_backup_size_bytes gauge
feedants_backup_size_bytes $bytes
EOF
  mv "$metrics_dir/backup.prom.tmp" "$metrics_dir/backup.prom"
fi
