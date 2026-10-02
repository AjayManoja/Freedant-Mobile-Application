#!/usr/bin/env bash
# Restores every service database from a backup (US-39, NFR-RL-07: RTO ≤ 1 h).
# Follow docs/05-operations/runbooks/restore.md: this REPLACES the live data.
#
#   restore.sh latest                  # newest backup in s3://$BACKUP_BUCKET/postgres/
#   restore.sh 20261003T203000Z        # a specific backup
#   BACKUP_DEST=/tmp/backups restore.sh latest   # from a local directory (drills)
#   ... --yes                          # skip the confirmation prompt
#
# Services are stopped (the gateway answers 502 meanwhile), each database is dropped and
# recreated exactly as infra/docker/postgres/init-databases.sh creates it, the dump is
# restored in one transaction owned by the service's role, and services start again.
set -euo pipefail

here=$(dirname "$(readlink -f "$0")")
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$here/lib.sh"
load_host_env

which=${1:?usage: restore.sh latest|<timestamp> [--yes]}
assume_yes=${2:-}
src=${BACKUP_DEST:-s3://${BACKUP_BUCKET:?BACKUP_BUCKET is not set}/postgres}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
started=$(date +%s)

if [[ $which == latest ]]; then
  if [[ $src == s3://* ]]; then
    which=$(aws s3 ls "$src/" | awk '/PRE/ {print $2}' | tr -d / | sort | tail -n 1)
  else
    which=$(find "$src" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | tail -n 1)
  fi
  [[ -n $which ]] || die "No backups found in $src"
fi

log "Fetching backup $which from $src"
if [[ $src == s3://* ]]; then
  aws s3 cp --recursive --only-show-errors "$src/$which/" "$work/"
else
  cp "$src/$which"/* "$work/"
fi
(cd "$work" && sha256sum --check --quiet SHA256SUMS) || die "Checksum mismatch: backup $which is damaged"
log "Checksums verified"

if [[ $assume_yes != --yes ]]; then
  read -r -p "Replace ALL data in ${DATABASES[*]} with backup $which? Type 'restore' to continue: " answer
  [[ $answer == restore ]] || die "Aborted"
fi

log "Stopping services"
compose stop "${SERVICES[@]}"

for db in "${DATABASES[@]}"; do
  log "Restoring $db"
  compose exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -q \
    -c "DROP DATABASE IF EXISTS $db WITH (FORCE)" \
    -c "CREATE DATABASE $db OWNER $db ENCODING 'UTF8' TEMPLATE template0" \
    -c "REVOKE ALL ON DATABASE $db FROM PUBLIC" \
    -c "GRANT CONNECT, TEMPORARY ON DATABASE $db TO $db"
  compose exec -T postgres pg_restore -U postgres --dbname "$db" --no-owner --role "$db" \
    --single-transaction --exit-on-error <"$work/$db.dump"
done

log "Starting services"
compose up -d --no-deps --wait --wait-timeout 180 "${SERVICES[@]}"
for svc in "${SERVICES[@]}"; do
  service_ready "$svc" || die "$svc is not ready after the restore; check its logs"
done

log "Restore of backup $which finished in $(($(date +%s) - started)) s (RTO target: 3600 s)"
log "Next: check dead-letter queues and run the smoke test (runbook steps 6-7)"
