#!/usr/bin/env bash
# Smoke test through the gateway (US-37): each service answers through nginx, over TLS when the
# URL is https. Used by deploy.sh on the host and by the deploy workflow from outside.
#
#   smoke.sh https://api.example.com              # from anywhere
#   smoke.sh https://api.example.com 127.0.0.1    # on the host: connect locally, still verify TLS
#   smoke.sh http://localhost:8080                # local stack
#
# Each check retries for ~20 s, so a service that is still warming up doesn't fail the deploy.
set -euo pipefail

base=${1:?usage: smoke.sh <base-url> [connect-ip]}
base=${base%/}
connect=${2:-}

curl_opts=(--silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}')
if [[ -n $connect ]]; then
  [[ $base =~ ^(https?)://([^/:]+)(:([0-9]+))?$ ]] || {
    echo "Can't parse $base" >&2
    exit 2
  }
  scheme=${BASH_REMATCH[1]}
  host=${BASH_REMATCH[2]}
  port=${BASH_REMATCH[4]:-$([[ $scheme == https ]] && echo 443 || echo 80)}
  curl_opts+=(--resolve "$host:$port:$connect")
fi

failures=0
check() {
  local path=$1 want=$2 what=$3 code=000
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    code=$(curl "${curl_opts[@]}" "$base$path" 2>/dev/null) || code=000
    [[ $code == "$want" ]] && break
    sleep 2
  done
  if [[ $code == "$want" ]]; then
    printf 'ok    %-13s %s %s\n' "$what" "$code" "$path"
  else
    printf 'FAIL  %-13s %s %s (wanted %s)\n' "$what" "$code" "$path" "$want"
    failures=$((failures + 1))
  fi
}

check /gateway/health 200 gateway
check /.well-known/jwks.json 200 identity
check /v1/categories 200 competition
check /v1/wallet 401 payment # reachable, and still enforcing authentication
check /v1/notifications 401 notification

if ((failures > 0)); then
  echo "Smoke test failed: $failures check(s)" >&2
  exit 1
fi
echo "Smoke test passed"
