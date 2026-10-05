#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 --url URL --name NAME [--attempts N] [--timeout SECONDS] [--expected BODY]" >&2
  exit 2
}

url=''
name=''
attempts=6
timeout=10
expected=''
while (($#)); do
  case "$1" in
    --url) url=${2:-}; shift 2 ;;
    --name) name=${2:-}; shift 2 ;;
    --attempts) attempts=${2:-}; shift 2 ;;
    --timeout) timeout=${2:-}; shift 2 ;;
    --expected) expected=${2:-}; shift 2 ;;
    *) usage ;;
  esac
done
[[ -n "$url" && -n "$name" ]] || usage
[[ "$attempts" =~ ^[1-9][0-9]*$ && "$timeout" =~ ^[1-9][0-9]*$ ]] || usage

for ((attempt=1; attempt<=attempts; attempt++)); do
  body_file=$(mktemp)
  status=''
  if status=$(curl --silent --show-error --location --max-time "$timeout" \
    --output "$body_file" --write-out '%{http_code}' "$url" 2>/tmp/learnix-health-error); then
    if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
      if [[ -z "$expected" ]] || grep -Fqx -- "$expected" "$body_file"; then
        rm -f "$body_file" /tmp/learnix-health-error
        printf '%s health check passed on attempt %d\n' "$name" "$attempt"
        exit 0
      fi
      reason="unexpected response body"
    else
      reason="HTTP $status"
    fi
  else
    reason=$(< /tmp/learnix-health-error)
  fi
  rm -f "$body_file"
  printf '%s health check attempt %d/%d failed: %s\n' "$name" "$attempt" "$attempts" "$reason" >&2
  ((attempt < attempts)) && sleep 2
done

echo "::error::$name health check failed after $attempts attempts"
exit 1
