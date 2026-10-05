#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
validate="$root/scripts/ci/validate-required-env.sh"
health="$root/scripts/ci/check-deployment-health.sh"
workflow="$root/.github/workflows/deploy.yml"
ci_workflow="$root/.github/workflows/ci.yml"
security_workflow="$root/.github/workflows/security.yml"
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

grep -Fq 'continue-on-error: true' "$workflow"
grep -Fq "Authorization: ******" "$workflow"
if grep -Fq "Authorization: ******" "$workflow"; then
  echo "Render requests still use a placeholder authorization value" >&2
  exit 1
fi
grep -Fq 'actions: read' "$workflow"
grep -Fq 'VERCEL_TARGET' "$workflow"
grep -Fq 'alias set' "$workflow"
ghcr_image_path="\${GITHUB_REPOSITORY,,}/learnix-api"
grep -Fq "$ghcr_image_path" "$workflow"
grep -Fq 'Require successful CI and security workflows' "$workflow"
grep -Fq "workflow_id, event: 'push', head_sha: context.sha" "$workflow" || grep -Fq 'head_sha: context.sha' "$workflow"
grep -Fq 'A required CI job did not succeed' "$ci_workflow"
grep -Fq "needs.e2e.result" "$ci_workflow"
grep -Fq '!= "success"' "$ci_workflow"
grep -Fq '!= "skipped"' "$ci_workflow"
if grep -Fq 'actions: read' "$security_workflow"; then
  echo "security workflow has unnecessary actions read permission" >&2
  exit 1
fi
grep -Fq 'name: Upload rollback diagnostics' "$workflow"
grep -Fq 'if: always()' "$workflow"
grep -Fq 'Provider rollback failed; inspect deployment-rollback-diagnostics.' "$workflow"
grep -Fq "priority: \${{ needs.deploy.result != 'success' && needs.rollback.result != 'success' && 'high' || 'normal' }}" "$workflow"
grep -Fq 'state == "READY"' "$workflow"
vercel_target_filter=".target == \$target"
grep -Fq "$vercel_target_filter" "$workflow"
grep -Fq "'production' && 'production' || 'preview'" "$workflow"
grep -Fq 'createdAt | type == "string"' "$workflow"
grep -Fq 'status == "live" or .status == "succeeded"' "$workflow"
grep -Fq 'finishedAt | type == "string"' "$workflow"
grep -Fq 'sha256:[a-f0-9]{64}' "$workflow"
grep -Fq "rollback_unavailable" "$workflow"
grep -Fq "needs.rollback.result != 'success'" "$workflow"
if grep -Fq 'target // "production"' "$workflow" || grep -Fq 'finishedAt // .createdAt' "$workflow"; then
  echo "previous-release capture still defaults missing metadata" >&2
  exit 1
fi
if grep -Fq '.[0].uid' "$workflow" || grep -Fq 'deploys?limit=1"' "$workflow"; then
  echo "previous-release capture still uses an unverified first/latest provider result" >&2
  exit 1
fi

echo "deployment script fixtures passed"
