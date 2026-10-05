# Task 5 Report: Protected Vercel/Render Delivery

## Status

Implemented the protected deployment workflow and committed it as:

`ci: add protected deployment and rollback flow`

## Delivered

- Added `.github/workflows/deploy.yml`:
  - Push-to-main and explicit `workflow_dispatch` inputs for `environment`,
    `image-digest`, `previous-vercel-deployment`, and
    `previous-render-release`.
  - Protected `staging`/`production` GitHub Environment selection.
  - Required successful CI lookup for the current commit before publishing or
    deploying.
  - Dedicated GHCR publish job with `packages: write` only on that job,
    Buildx, commit-SHA tagging, digest output, provenance, and SBOM generation.
  - Environment-scoped validation for Vercel, Render, webhook, and public
    frontend API configuration.
  - Exact previous Vercel deployment and Render deploy capture before provider
    mutation, persisted as job outputs and an artifact.
  - Vercel production deployment and Render image-backed deployment using the
    immutable `ghcr.io/...@sha256:<digest>` reference.
  - Bounded API (`/health`, expected `OK`) and frontend (`/`) probes.
  - Always-run rollback for failed deployment/health jobs. Vercel promotion
    uses the captured deployment UID; Render rollback uses the captured deploy
    ID through the documented service rollback API.
  - Failure/success notification path with safe repository, run, frontend, and
    API links only.
- Extended `.github/actions/notify/action.yml` with optional safe provider
  links while preserving non-blocking webhook failure behavior.
- Added `scripts/ci/validate-required-env.sh` for explicit required-value
  validation without printing secret values.
- Added `scripts/ci/check-deployment-health.sh` with bounded retries, request
  timeouts, non-2xx failure, network/timeout failure, and optional exact body
  validation.
- Added `scripts/ci/test-deployment-scripts.sh` with a local HTTP fixture
  covering success, missing values, non-2xx, and timeout behavior.

## Environment contract

Each protected GitHub Environment must provide:

- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
  `RENDER_API_KEY`, `RENDER_SERVICE_ID`, and `DISCORD_WEBHOOK`.
- Variables: `FRONTEND_URL`, `RENDER_API_URL` (the deployed public API base
  URL), and `VITE_API_URL` (the public build-time frontend API URL).
- The Render service must already be configured as an image-backed service
  pointing at the same GHCR host, repository, and image name. Render's API
  requires those values to match when `imageUrl` is supplied.
- GHCR pull credentials/configuration must exist in the Render service's
  provider secret store; the workflow never exposes a registry credential.

`RENDER_PROVIDER_API_URL` is deliberately fixed to the documented
`https://api.render.com` endpoint. The environment's `RENDER_API_URL` remains
the public application URL used by health probes.

## Verification

Passed:

- `scripts/ci/test-deployment-scripts.sh`
  - required-value success and failure;
  - successful expected-body probe;
  - non-2xx probe failure;
  - timeout probe failure.
- Python YAML parsing for `.github/workflows/deploy.yml` and
  `.github/actions/notify/action.yml`.
- Deterministic workflow contract assertions for immutable digest publishing,
  provenance/SBOM, release inputs, probes, and rollback.
- `bash -n scripts/ci/*.sh` for the Task 5 scripts.
- `pnpm exec prettier --check .github/workflows/deploy.yml
  .github/actions/notify/action.yml`.
- `git diff --check`.

## Provider-backed verification

No Vercel, Render, GHCR, GitHub Environment, or Discord credentials are
available in this local environment. No provider-backed staging or production
deployment was attempted, and no provider operation was faked. Consequently,
the following remain unverified locally: Vercel CLI deployment/inspection and
promotion, Render image-backed deploy and rollback API responses, GHCR
provenance/SBOM publication, protected-environment approval behavior, and
Discord delivery. The first GitHub Actions run with the environment contract
above is the required integration verification.

## Concerns

- The workflow requires the Render service's configured image host,
  repository, and image name to match the GHCR reference, as required by
  Render's `imageUrl` API validation.
- Automatic rollback restores provider releases only; database migrations are
  intentionally outside this task's rollback scope.
- `actionlint` and live GitHub Actions execution were unavailable locally;
  workflow syntax was validated with a YAML parser and targeted structural
  assertions.
