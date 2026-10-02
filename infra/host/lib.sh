# shellcheck shell=bash
# Shared helpers for the host scripts in this folder. Sourced, never executed.
#
# The scripts run on the production host (Amazon Linux 2023, see infra/terraform) as root,
# from the release being deployed: /opt/feedants/releases/<sha>/infra/host/.
#
# FEEDANTS_COMPOSE overrides the Compose command, so backup.sh and restore.sh can also run
# against the local stack for restore drills:
#   FEEDANTS_COMPOSE="docker compose -f infra/docker/compose.yaml" BACKUP_DEST=/tmp/b infra/host/backup.sh

FEEDANTS_HOME=${FEEDANTS_HOME:-/opt/feedants}
# shellcheck disable=SC2034 # used by the scripts that source this file
SERVICES=(identity competition payment notification)
# shellcheck disable=SC2034
DATABASES=(identity competition payment notification)

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() {
  log "ERROR: $*"
  exit 1
}

# Settings written once by the instance bootstrap (Terraform user_data): ENVIRONMENT,
# AWS_REGION, REPOSITORY, REGISTRY, BACKUP_BUCKET, DOMAIN, ACME_EMAIL.
load_host_env() {
  if [[ -f $FEEDANTS_HOME/host.env ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$FEEDANTS_HOME/host.env"
    set +a
  fi
}

# Compose file of the release in use; deploy.sh points it at the release being deployed.
COMPOSE_FILE_PATH=${COMPOSE_FILE_PATH:-$FEEDANTS_HOME/current/infra/docker/compose.prod.yaml}
# Image tags per service; deploy.sh points it at the candidate release while rolling.
RELEASE_ENV=${RELEASE_ENV:-$FEEDANTS_HOME/release.env}

compose() {
  if [[ -n ${FEEDANTS_COMPOSE:-} ]]; then
    local -a cmd
    read -r -a cmd <<<"$FEEDANTS_COMPOSE"
    "${cmd[@]}" "$@"
  else
    docker compose -f "$COMPOSE_FILE_PATH" --env-file "$FEEDANTS_HOME/.env" --env-file "$RELEASE_ENV" "$@"
  fi
}

# Readiness (dependencies reachable), checked from inside the container: /health is not routed
# by the gateway.
service_ready() {
  compose exec -T "$1" node -e \
    "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
}
