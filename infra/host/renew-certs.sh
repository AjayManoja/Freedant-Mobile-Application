#!/usr/bin/env bash
# TLS certificate from Let's Encrypt for $DOMAIN, stored under the fixed name "feedants" so
# nginx.prod.conf never needs the domain. Run by deploy.sh on first deploy (before the gateway
# exists, so certbot answers the HTTP-01 challenge itself on :80) and twice a day by
# feedants-certs.timer, which renews through the running gateway's webroot and reloads it.
set -euo pipefail

here=$(dirname "$(readlink -f "$0")")
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$here/lib.sh"
load_host_env
: "${DOMAIN:?DOMAIN is not set}" "${ACME_EMAIL:?ACME_EMAIL is not set}"

if [[ ! -f $FEEDANTS_HOME/letsencrypt/live/feedants/fullchain.pem ]]; then
  log "Issuing a certificate for $DOMAIN"
  docker run --rm -p 80:80 -v "$FEEDANTS_HOME/letsencrypt:/etc/letsencrypt" certbot/certbot:v5.8.0 \
    certonly --standalone --non-interactive --agree-tos -m "$ACME_EMAIL" -d "$DOMAIN" --cert-name feedants
  exit 0
fi

compose --profile tools run --rm certbot renew --webroot -w /var/www/certbot --quiet
compose exec -T gateway nginx -s reload
