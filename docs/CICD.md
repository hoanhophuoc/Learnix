# Learnix CI/CD operations runbook

This document describes the CI, security, deployment, and rollback contracts
implemented in this repository. It is intentionally operational: commands and
names below match the checked-in workflows rather than an assumed future
platform.

## 1. Workflow map and ownership

### Continuous integration (`.github/workflows/ci.yml`)

CI runs for pull requests targeting `main` and pushes to `main` when a
path-filtered application, package, database, Docker, build, lockfile, or CI
configuration file changes. The workflow cancels an older run for the same
branch/PR when a newer run starts.

The required CI stages are:

- **Format Check**: repository-wide `prettier --check`.
- **Backend** and **Frontend**: the reusable workflow runs typecheck, ESLint,
  tests, and then build when those gates succeed.
- **React Doctor**: `pnpm --filter @repo/web doctor`.
- **Docker image validation**: builds the API and web images.
- **Compose smoke test**: starts the full stack, waits for health, probes the
  API and frontend, uploads Compose logs on failure, and always tears down.
- **E2E Tests**: runs only for pull requests, with PostgreSQL, Chromium, a
  seeded database, and uploaded Playwright artifacts.
- **CI Status**: aggregates all stages and fails if any stage fails.

The `main` branch should require the **CI Status**, backend/frontend build
gates, Compose smoke, and security status checks in repository branch
protection. The deployment workflow independently looks up a successful
`ci.yml` push run for the exact commit before publishing or deploying, so a
manual deployment cannot bypass CI. Repository administrators own branch rules;
the application maintainers own fixing failed checks.

### Security (`.github/workflows/security.yml`)

Security runs on pull requests and pushes to `main` or `develop`, every Sunday
at 00:00 UTC, and on manual dispatch:

- PR dependency review fails on high/critical findings or GPL-3.0/AGPL-3.0.
- CodeQL JavaScript/TypeScript `security-and-quality` analysis runs for trusted
  repository events; fork pull requests skip CodeQL's build/analyze job.
- `pnpm audit --audit-level=high` audits the workspace lockfile.
- SonarQube/SonarCloud is conditional on the repository variable
  `SONAR_ENABLED=true`, requires `SONAR_TOKEN`, and requires non-empty
  `apps/coverage/lcov.info`.
- `security-summary` records every result. A configured security webhook gets a
  failure notification; no webhook is a valid configured state and emits a
  warning instead.

Security findings are owned by the maintainer responsible for the affected
dependency or code. Provider configuration is owned by the repository
administrators/security owner.

### Protected deployment (`.github/workflows/deploy.yml`)

Deployment runs for path-filtered pushes to `main` and supports manual
dispatch. Manual dispatch selects `staging` or `production` and may provide an
existing immutable `sha256:` image digest plus explicit rollback identifiers.
The workflow uses the GitHub Environment named by the input; production
approval/review is therefore configured in GitHub, not encoded in shell logic.

The workflow:

1. Verifies successful CI and security push runs for the exact commit; a
   missing or non-successful workflow run blocks deployment.
2. Builds and publishes the API image to GHCR with commit-SHA tagging,
   provenance, and SBOM, unless an existing digest was supplied.
3. Captures a verified previous Vercel deployment for the selected target and
   the matching Render release, unless explicit identifiers were supplied.
4. Deploys the frontend to Vercel and the immutable API image to Render.
5. Probes `RENDER_API_URL/health` expecting an exact `OK` line and probes the
   frontend root URL.
6. On deployment failure, attempts provider rollback and uploads
   `deployment-rollback-diagnostics`.
7. Sends a non-blocking Discord/webhook notification with safe run, frontend,
   and API links. Rollback failure or unavailable rollback is high priority.

The deployment owner is the release maintainer. GitHub Environment approvers
own production approval; Vercel/Render project owners own provider access.

## 2. Environment and secret setup

Never commit real values. Put local values in ignored `.env` files copied from
[`apps/api/.env.example`](/home/phuochoan/Projects/Learnix/apps/api/.env.example)
and
[`apps/web/.env.example`](/home/phuochoan/Projects/Learnix/apps/web/.env.example).
Put deployment values in GitHub Environment configuration and provider secret
stores. `VITE_*` variables are public: Vite embeds them into browser assets;
they are not secrets.

### Development and local Compose

`docker-compose.yml` supplies safe development defaults for PostgreSQL:

| Scope     | Variable                                                      | Purpose                                           |
| --------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Compose   | `POSTGRES_USER`                                               | PostgreSQL user; defaults to `postgres`           |
| Compose   | `POSTGRES_PASSWORD`                                           | Local database password; defaults to `postgres`   |
| Compose   | `POSTGRES_DB`                                                 | Local database name; defaults to `learnix`        |
| API       | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Database connection                               |
| API       | `JWT_SECRET`                                                  | Local signing key; replace outside local-only use |
| API       | `FRONTEND_URL`                                                | CORS and OAuth redirect origin                    |
| API       | `NODE_ENV`                                                    | Runtime mode, normally `development` locally      |
| Web build | `VITE_API_URL`                                                | Public API URL embedded in the frontend           |
| Web build | `VITE_APP_NAME`                                               | Public application display name                   |

The API example also documents OAuth client secrets, SMTP credentials,
Cloudinary credentials, Gemini API access, `DATABASE_URL`, `BACKEND_URL`,
`UPLOAD_PATH`, and cookie/JWT settings. Add those only when the corresponding
feature is used. Do not use the Compose defaults in staging or production.

### Staging and production GitHub Environments

Create separate GitHub Environments named `staging` and `production`.
Production should require reviewers and may restrict deployment branches.
Configure these **environment secrets** in GitHub:

- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `RENDER_API_KEY`, `RENDER_SERVICE_ID`
- `DISCORD_WEBHOOK`

Configure these **environment variables**:

- `FRONTEND_URL`: deployed Vercel URL used for the frontend probe and
  environment link.
- `RENDER_API_URL`: public Render API base URL used for the `/health` probe.
- `VITE_API_URL`: public API URL recorded for deployment validation. The
  workflow maps this to `PUBLIC_VITE_API_URL` but does not inject it into the
  Vercel build; configure the same `VITE_API_URL` value in the Vercel project
  environment/build settings for each target environment.
- `VERCEL_STAGING_DOMAIN`: staging-only Vercel alias used for preview deploys
  and staging rollback.

The Render service must already be an image-backed service configured for the
same GHCR host/repository/image name. GHCR pull credentials belong in the
Render provider secret store. The workflow uses the fixed Render API endpoint
`https://api.render.com`; `RENDER_API_URL` is the application URL, not that
provider endpoint. Render requests use the environment-scoped
`RENDER_API_KEY` only in the bearer header and never log it. GHCR owner and
repository names are normalized to lowercase before image publication or
Render deployment. Staging uses a Vercel preview deployment and alias; only
production uses Vercel production promotion.

For Sonar, set repository variable `SONAR_ENABLED=true` only after the
repository has a `SONAR_TOKEN` secret. For security failure notifications,
configure `SECURITY_NOTIFICATION_WEBHOOK` as a repository or environment
secret as appropriate. Missing optional notification configuration must remain
visible as a workflow warning.

Provider dashboards:

- GitHub Actions: <https://github.com/hoanhophuoc/Learnix/actions>
- GitHub Environments/settings: <https://github.com/hoanhophuoc/Learnix/settings/environments>
- Vercel project dashboard: `https://vercel.com/<org>/<project>`
- Render service dashboard: `https://dashboard.render.com/web/<service-id>`
- Sonar project dashboard: <https://sonarcloud.io/project/overview?id=hoanhophuoc_Learnix>

Replace the provider placeholders with the team's actual project links in an
organization-specific copy of this runbook; never put tokens in links.

## 3. Release and deployment runbooks

### Local Compose verification

From the repository root:

```bash
pnpm install --frozen-lockfile
docker compose up -d --build
docker compose ps
curl --fail http://localhost:3000/health
curl --fail http://localhost:5173/
docker compose down -v
```

`postgres` must be healthy before the API starts; the API healthcheck is
`http://127.0.0.1:3000/health`, and the frontend healthcheck is
`http://127.0.0.1:3000/` inside its container (published as port 5173).
`docker compose ps --wait` is preferred when available. Use
`docker compose logs --no-color` before teardown when diagnosing a failure.

### Staging promotion

1. Merge only after the required CI and security checks pass.
2. Confirm `staging` secrets and variables are configured.
3. Use **Run workflow** for `Protected deployment`, select `staging`, and
   leave `image-digest` empty for a new build, or supply a previously published
   immutable digest for a promotion.
4. Confirm the workflow's CI lookup, GHCR digest, Vercel deployment, Render
   release, API `OK` probe, and frontend probe.
5. Save the run URL and release-capture artifact for the change record.

### Production promotion

1. Verify staging probes and application smoke tests.
2. Start the protected deployment with `production`.
3. A configured GitHub Environment reviewer approves the job.
4. Confirm the immutable digest and both provider probes before announcing the
   release.
5. Verify the notification links and retain the workflow artifacts.

### Rollback

Automatic rollback is limited to provider releases and runs only when the
deployment job fails. It promotes the captured verified Vercel deployment and
posts the captured Render deploy ID to the Render rollback endpoint. It does
not roll back database migrations, external data, third-party side effects, or
an unverified provider release. If capture, credentials, or provider access is
missing, rollback is unavailable and the notification is high priority.

The deployment workflow has no rollback-only dispatch mode. Its
`previous-vercel-deployment` and `previous-render-release` inputs only provide
targets to the automatic rollback path if that deployment run later fails; a
dispatch with those inputs still performs the normal CI check, image/deploy
flow, and health probes.

For a manual provider rollback, use the exact identifiers captured by the
failed run or confirmed in the provider dashboards:

1. In the Vercel project dashboard, open the known-good production deployment
   and use **Promote to Production**. The equivalent CLI operation is
   `vercel promote <deployment-uid> --token <token> --scope <org-id>`.
2. In the Render service dashboard, choose the known-good deploy and use its
   rollback action. For an API-based operation, call
   `POST https://api.render.com/v1/services/<service-id>/rollback` with
   `{"deployId":"<render-deploy-id>"}` and the Render API key.
3. Rerun the API and frontend probes manually and record the provider
   operation IDs and timestamps.

If provider rollback fails, stop retrying blindly, page the release owner,
preserve `deployment-rollback-diagnostics`, and use the provider dashboards for
incident recovery.

## 4. Maintenance

- **Dependencies**: update `package.json` and `pnpm-lock.yaml` together; run
  frozen install, format, lint, typecheck, tests, and build. Review
  `pnpm audit` findings rather than lowering the high-severity gate.
- **pnpm policy**: the root `packageManager` is the source of truth
  (`pnpm@12.9.1` currently). The shared setup action reads that field and
  installs the exact version. Update the manifest and lockfile deliberately;
  do not hard-code a different CI version.
- **React Doctor**: run `pnpm --filter @repo/web doctor` after React or web
  dependency changes. Remediate findings in source/configuration; do not
  suppress a finding merely to make CI green.
- **Actions**: review action major versions and pinned provider action SHAs
  during dependency maintenance. Check release notes and rerun workflow
  contract checks after updates.
- **CodeQL/Sonar**: keep CodeQL on the maintained action major and review
  security-and-quality alerts. If Sonar is enabled, keep the token valid,
  coverage path non-empty, project key, exclusions, and lcov paths aligned
  with `sonar-project.properties`.
- **Caches**: dependency caches are keyed by the lockfile hash; Playwright is
  keyed by OS and lockfile; Sonar uses the runner Sonar cache. Change the
  relevant cache key or clear the provider cache when a corrupted cache is
  suspected. Never use cache invalidation to hide a reproducible failure.
- **Notifications**: test webhook delivery with a non-production workflow or
  provider test endpoint. Notification failure is intentionally non-blocking,
  but missing configuration must remain actionable in logs.

## 5. Troubleshooting

| Symptom                           | First checks                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| CI does not start                 | Confirm the changed path is in the workflow path filters and the target is `main`.                 |
| Deployment says CI has not passed | Find the `ci.yml` push run for the exact commit SHA; rerun/fix CI before deploying.                |
| Compose API is unhealthy          | Run `docker compose logs backend postgres`; verify PostgreSQL health and database variables.       |
| Frontend probe fails              | Check the web image build argument `VITE_API_URL`, container logs, and port 5173.                  |
| E2E fails only in CI              | Download Playwright report/test-results and confirm the PostgreSQL service and seed step.          |
| Sonar is skipped                  | Check `SONAR_ENABLED`; if true, verify `SONAR_TOKEN` and non-empty API lcov output.                |
| Rollback is unavailable           | Inspect release-capture and rollback artifacts; verify provider IDs and environment secrets.       |
| Provider health probe fails       | Check public URLs, provider deployment state, HTTP status/body, and provider logs before retrying. |

## 6. Verification limits

The repository can verify formatting, lint, typecheck, unit tests, builds,
workflow structure, deployment scripts, and local Compose behavior when Docker
is installed and available. GitHub Actions execution, protected Environment
approval, GHCR publication/provenance/SBOM, Vercel deployment/promotion,
Render image deployment/rollback, Sonar provider analysis, CodeQL provider
analysis, and Discord delivery require credentials and platform access. They
must be verified by the first authorized workflow run; local checks must not
pretend to validate them.
