#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
validate="$root/scripts/ci/validate-required-env.sh"
health="$root/scripts/ci/check-deployment-health.sh"
fixture_dir="$(mktemp -d)"
server_pid=''
cleanup() {
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

[[ "$(FOO=value "$validate" FOO)" == "Validated required deployment values: FOO" ]]
if "$validate" MISSING >/dev/null 2>&1; then
  echo "missing-value validation unexpectedly passed" >&2
  exit 1
fi

cat > "$fixture_dir/server.py" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys, time

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/ok":
            self.send_response(200); self.end_headers(); self.wfile.write(b"OK")
        elif self.path == "/bad":
            self.send_response(503); self.end_headers(); self.wfile.write(b"unavailable")
        else:
            time.sleep(3)
    def log_message(self, *_): pass

HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
PY
python3 "$fixture_dir/server.py" 18991 &
server_pid=$!
sleep 1

"$health" --name fixture-success --url http://127.0.0.1:18991/ok --expected OK --attempts 1
if "$health" --name fixture-status --url http://127.0.0.1:18991/bad --attempts 1 >/dev/null 2>&1; then
  echo "non-2xx health check unexpectedly passed" >&2
  exit 1
fi
if "$health" --name fixture-timeout --url http://127.0.0.1:18991/slow --timeout 1 --attempts 1 >/dev/null 2>&1; then
  echo "timeout health check unexpectedly passed" >&2
  exit 1
fi

echo "deployment script fixtures passed"
