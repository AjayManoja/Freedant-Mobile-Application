#!/usr/bin/env bash
# Deploys one commit to this host, service by service, with automatic rollback (US-37).
# Run as root by the deploy workflow through SSM Run Command; see docs/05-operations/DEPLOYMENT.md.
#
#   deploy.sh <git-sha>     # deploy the images built for that commit
#   deploy.sh --rollback    # redeploy the previous successful release
#
# Steps:
#   1. Fetch the release's infra/ folder from GitHub and render /opt/feedants/.env from SSM.
#   2. Pull the commit's images; start or update infrastructure (DB, broker, monitoring).
#   3. Run every service's migrations. Migrations are expand-only (docs/03-development/
#      LOCAL_SETUP.md §6), so the running version keeps working against the new schema.
#   4. Replace services one at a time; each must turn healthy and ready before the next.
#   5. Reload the gateway and smoke-test through it over TLS.
#   Any failure in 4-5 restores the previous image tags and config, and the run fails.
set -euo pipefail

here=$(dirname "$(readlink -f "$0")")
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$here/lib.sh"
load_host_env
: "${ENVIRONMENT:?}" "${AWS_REGION:?}" "${REPOSITORY:?}" "${REGISTRY:?}" "${DOMAIN:?}" "${ACME_EMAIL:?}"

exec 9>"$FEEDANTS_HOME/deploy.lock"
flock -n 9 || die "Another deploy is running"

state=$FEEDANTS_HOME/state
mkdir -p "$state" "$FEEDANTS_HOME/releases" "$FEEDANTS_HOME/config" "$FEEDANTS_HOME/run" \
  "$FEEDANTS_HOME/metrics" "$FEEDANTS_HOME/letsencrypt" "$FEEDANTS_HOME/certbot-www"

rolling_back=false
if [[ ${1:-} == --rollback ]]; then
  rolling_back=true
  sha=$(cat "$state/previous" 2>/dev/null) || die "No previous release to roll back to"
  log "Rolling back to the previous release $sha"
else
  sha=${1:?usage: deploy.sh <git-sha> | --rollback}
fi
[[ $sha =~ ^[0-9a-f]{40}$ ]] || die "Expected a full 40-character commit SHA, got '$sha'"
current_sha=$(cat "$state/current" 2>/dev/null || true)

# --- 1. Release files and settings ---------------------------------------------------------

release=$FEEDANTS_HOME/releases/$sha
if [[ ! -d $release/infra ]]; then
  log "Fetching infra/ for $sha"
  mkdir -p "$release.tmp"
  curl -fsSL "https://codeload.github.com/$REPOSITORY/tar.gz/$sha" |
    tar -xz -C "$release.tmp" --strip-components=1 --wildcards '*/infra/*'
  mv "$release.tmp" "$release"
fi

# SSM parameters under /feedants/<env>/ become KEY='value' lines. Single quotes keep Compose
# from interpolating `$` in secrets; newlines (the JWT PEM) are stored as literal \n.
render_env() {
  local out=$FEEDANTS_HOME/.env.new program
  read -r -d '' program <<'JQ' || true
.Parameters[]
| (.Name | split("/") | last) as $key
| if (.Value | contains("'")) then error("\($key) contains a single quote, which .env can't hold")
  else "\($key)='\(.Value | gsub("\n"; "\\n"))'" end
JQ
  # Subshell: the 077 umask must not leak into the config files containers read later.
  (
    umask 077
    aws ssm get-parameters-by-path --region "$AWS_REGION" --path "/feedants/$ENVIRONMENT/" \
      --recursive --with-decryption --output json | jq -r "$program" >"$out"
  )
  printf "REGISTRY='%s'\nNODE_ENV='production'\n" "$REGISTRY" >>"$out"
  local unset_keys
  unset_keys=$(grep "='CHANGE_ME'$" "$out" | cut -d= -f1 | tr '\n' ' ' || true)
  [[ -z $unset_keys ]] || die "SSM placeholders not set yet: $unset_keys(docs/05-operations/DEPLOYMENT.md §2)"
  mv "$out" "$FEEDANTS_HOME/.env"
}
log "Rendering settings from SSM /feedants/$ENVIRONMENT/"
render_env

# Optional: a read-only GHCR token for private images (SSM GHCR_TOKEN).
ghcr_token=$(grep -E "^GHCR_TOKEN=" "$FEEDANTS_HOME/.env" | cut -d"'" -f2 || true)
if [[ -n $ghcr_token ]]; then
  echo "$ghcr_token" | docker login ghcr.io -u "${REPOSITORY%%/*}" --password-stdin >/dev/null
fi

# Config files live at stable paths the containers mount (see compose.prod.yaml).
sync_config() {
  local from=$1
  mkdir -p "$FEEDANTS_HOME/config"/{nginx,monitoring,jaeger,postgres}
  cp "$from"/infra/nginx/*.conf "$FEEDANTS_HOME/config/nginx/"
  cp "$from"/infra/monitoring/prometheus.yml "$from"/infra/monitoring/alerts.yml "$FEEDANTS_HOME/config/monitoring/"
  cp "$from"/infra/jaeger/config.yaml "$FEEDANTS_HOME/config/jaeger/"
  cp "$from"/infra/docker/postgres/init-databases.sh "$FEEDANTS_HOME/config/postgres/"
  # Prometheus, Jaeger and Postgres read these as non-root users.
  chmod -R a+rX "$FEEDANTS_HOME/config"
  set -a
  # shellcheck disable=SC1091
  source "$FEEDANTS_HOME/.env"
  set +a
  envsubst <"$from/infra/monitoring/alertmanager.yml.tmpl" >"$FEEDANTS_HOME/run/alertmanager.yml"
  chmod 644 "$FEEDANTS_HOME/run/alertmanager.yml" # read by the container's non-root user
}

reload_config() {
  if compose ps --status running --services | grep -qx gateway; then
    compose exec -T gateway nginx -t -q && compose exec -T gateway nginx -s reload
  fi
  compose restart prometheus alertmanager >/dev/null
}

# --- 2. Images and infrastructure ----------------------------------------------------------

candidate=$FEEDANTS_HOME/release.env.next
{
  for svc in "${SERVICES[@]}"; do echo "${svc^^}_TAG=$sha"; done
} >"$candidate"
[[ -f $FEEDANTS_HOME/release.env ]] || cp "$candidate" "$FEEDANTS_HOME/release.env"
cp "$FEEDANTS_HOME/release.env" "$state/release.env.previous"

export COMPOSE_FILE_PATH=$release/infra/docker/compose.prod.yaml
log "Pulling images for $sha"
RELEASE_ENV=$candidate compose --profile migrate pull --quiet

sync_config "$release"
if [[ ! -f $FEEDANTS_HOME/letsencrypt/live/feedants/fullchain.pem ]]; then
  log "Issuing the TLS certificate for $DOMAIN"
  "$release/infra/host/renew-certs.sh"
fi

log "Starting infrastructure"
compose up -d --wait --wait-timeout 180 postgres redis rabbitmq jaeger prometheus alertmanager node-exporter
reload_config

# --- 3. Migrations -------------------------------------------------------------------------

for svc in "${SERVICES[@]}"; do
  log "Migrating $svc"
  RELEASE_ENV=$candidate compose --profile migrate run --rm "$svc-migrate" ||
    die "Migration for $svc failed; nothing was switched (the running version is unaffected)"
done

# --- 4-5. Roll services, smoke test, roll back on failure ----------------------------------

switched=()
rollback() {
  [[ -n $current_sha ]] || die "First deploy of $sha failed; there is no previous release to restore"
  log "Rolling back ${switched[*]:-nothing} to the previous release"
  cp "$state/release.env.previous" "$FEEDANTS_HOME/release.env"
  if [[ -n $current_sha && -d $FEEDANTS_HOME/releases/$current_sha ]]; then
    sync_config "$FEEDANTS_HOME/releases/$current_sha"
    export COMPOSE_FILE_PATH=$FEEDANTS_HOME/releases/$current_sha/infra/docker/compose.prod.yaml
  fi
  for svc in "${switched[@]}"; do
    compose up -d --no-deps --wait --wait-timeout 120 "$svc" || log "Rollback of $svc did not turn healthy"
  done
  reload_config || true
  smoke || log "Smoke test still failing after rollback: investigate now"
  die "Deploy of $sha failed and was rolled back"
}

# Through the local gateway, but with the real hostname, so TLS and the certificate are checked.
smoke() { "$release/infra/host/smoke.sh" "https://$DOMAIN" 127.0.0.1; }

for svc in "${SERVICES[@]}"; do
  log "Deploying $svc"
  sed -i "s/^${svc^^}_TAG=.*/${svc^^}_TAG=$sha/" "$FEEDANTS_HOME/release.env"
  switched+=("$svc")
  if ! compose up -d --no-deps --wait --wait-timeout 120 "$svc"; then
    log "$svc did not become healthy"
    rollback
  fi
  if ! service_ready "$svc"; then
    log "$svc is healthy but not ready (a dependency check failed)"
    rollback
  fi
done

compose up -d --no-deps gateway
reload_config
log "Smoke-testing through the gateway"
smoke || rollback

# --- Success -------------------------------------------------------------------------------

if $rolling_back; then
  rm -f "$state/previous" # a second --rollback must not bounce back to the release just undone
elif [[ -n $current_sha && $current_sha != "$sha" ]]; then
  echo "$current_sha" >"$state/previous"
fi
echo "$sha" >"$state/current"
ln -sfn "$release" "$FEEDANTS_HOME/current"

# Timers for backups and certificate renewal come from the release too.
cp "$release"/infra/host/systemd/*.service "$release"/infra/host/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now feedants-backup.timer feedants-certs.timer >/dev/null

# Keep the last five releases (rollback targets) and drop images nothing uses.
find "$FEEDANTS_HOME/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn |
  tail -n +6 | cut -d' ' -f2- | grep -v -e "/$sha$" -e "/${current_sha:-none}$" | xargs -r rm -rf
docker image prune -af --filter "until=168h" >/dev/null || true

log "Deployed $sha"
