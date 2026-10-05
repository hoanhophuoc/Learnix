# Learnix Production CI/CD Modernization Design

## Status

Draft for review

## Goals

Upgrade the Learnix monorepo to current compatible dependency versions, remediate React Doctor findings, verify the Docker Compose stack, and establish a maintainable GitHub Actions delivery system.

The system must:

- lint, typecheck, test, and build the web and API workspaces;
- validate the Docker image and Docker Compose stack;
- cache package-manager, browser, and analysis dependencies;
- run CodeQL, dependency review, SonarQube/SonarCloud, and dependency security checks;
- deploy the frontend to Vercel and the backend to Render;
- support development, staging, and production configuration without committing secrets;
- notify maintainers about failures, successful deployments, and rollback events;
- roll back failed releases when deployment or post-deployment health checks fail;
- document operation and maintenance procedures.

## Constraints and assumptions

- The repository is a pnpm/Turborepo monorepo with `apps/web` and `apps/api` workspaces.
- The existing deployment targets are Vercel for the frontend and Render for the API.
- Docker Compose is the local production-like smoke-test environment, not the production runtime.
- Existing uncommitted modernization changes are intentional and must be integrated rather than discarded.
- GitHub Environments named `staging` and `production` provide environment-specific variables, secrets, and optional approval gates.
- Secrets are supplied through GitHub Secrets or the deployment provider's secret store. Example files contain placeholders only.
- Provider-specific rollback APIs and credentials must fail explicitly when required configuration is absent; workflows must not silently report a successful deployment.

## Architecture

### Workflow boundaries

The pipeline is split into independently understandable workflows:

1. **CI** (`.github/workflows/ci.yml`)
   - Runs for pull requests and pushes to protected branches.
   - Installs dependencies using the committed pnpm lockfile.
   - Runs formatting, linting, typechecking, unit tests, React Doctor, Docker image build, and Compose smoke tests.
   - Uploads useful logs and reports on failure.

2. **Security and quality** (`.github/workflows/security.yml`)
   - Runs on pull requests, protected branch pushes, and a scheduled weekly scan.
   - Runs dependency review on pull requests.
   - Runs CodeQL JavaScript/TypeScript analysis with the `security-and-quality` query suite.
   - Runs pnpm audit with a documented severity policy.
   - Runs SonarQube/SonarCloud analysis using the repository project configuration and cached analyzer data.

3. **CD** (`.github/workflows/deploy.yml`)
   - Runs after required CI and security checks succeed on the deployment branch, and supports explicit manual dispatch.
   - Uses GitHub Environment protection for staging and production.
   - Builds and publishes immutable container tags to GHCR where the Render deployment uses the image.
   - Deploys the Vercel frontend and Render API.
   - Polls live health endpoints after deployment.
   - On a failed deployment or health check, invokes provider rollback and emits a failure/rollback notification.
   - Emits a success notification only after all post-deployment checks pass.

Reusable workflow or composite-action helpers should own repeated setup such as Node/pnpm installation, dependency caching, and notification formatting. Action references should use maintained major versions and, where repository policy requires it, pinned commit SHAs.

### Pipeline flow

Pull requests run quality and security validation but do not deploy. A successful push to the deployment branch produces a tested image, publishes it, deploys the selected environment, verifies health, and then reports success. Production can require an approval gate before the deployment job starts.

The deployment job records the previous known-good deployment identifier before changing traffic. Rollback uses that identifier rather than an ambiguous `latest` tag. Container images are tagged with the commit SHA and an environment/release tag; mutable tags are convenience aliases only.

## Dependency modernization

Run npm-check-updates against the root and workspace manifests, refresh `pnpm-lock.yaml`, and then validate the complete workspace. Major upgrades must be checked for framework, compiler, test-runner, and runtime compatibility. The final dependency changes must preserve the existing package manager and Node.js engine contract.

Dependency changes are accepted only when:

- lockfile installation succeeds in frozen mode;
- lint, typecheck, tests, and builds pass;
- the Docker image builds;
- the Compose smoke test reaches healthy services;
- high/critical actionable audit findings are resolved or explicitly documented with an owner and reason.

## React Doctor remediation

Run `npx react-doctor@latest` against `apps/web` after dependency upgrades. Fix actionable findings in the source and retain configuration exceptions only where the pattern is intentional, safe, and documented. Broad suppression of a rule is not a substitute for remediation. The CI job must run React Doctor so regressions are visible.

## Docker and Compose

The Dockerfile remains multi-stage and builds either workspace through an explicit `APP_NAME` argument. It must:

- use a supported Node LTS/runtime image;
- install only the tools needed by each stage;
- preserve non-root execution;
- use exec-form process startup where possible;
- pass build-time `VITE_*` values explicitly;
- expose a deterministic health endpoint for each service.

Compose must:

- use a persistent PostgreSQL volume;
- define service healthchecks and dependency conditions;
- avoid requiring untracked `.env` files for a basic local boot;
- mount database initialization assets when appropriate;
- avoid embedding production credentials;
- allow the stack to be started with `docker compose up -d --build`.

The smoke test waits for service health, checks the API and frontend HTTP endpoints, captures logs on failure, and tears the stack down in an always-run cleanup step.

## Environments and secrets

| Environment | Purpose | Deployment |
|---|---|---|
| development | local developer workflows and Compose | local machine |
| staging | pre-production release verification | Vercel preview/target and Render staging service |
| production | customer-facing release | Vercel production and Render production service |

Non-sensitive values such as public API URLs may be GitHub Environment variables. Credentials, signing keys, provider tokens, webhook URLs, database URLs, and API keys must be GitHub Environment secrets or provider-managed secrets.

Required secrets and variables must be listed in the operations guide with scope and purpose. Workflows should validate required values at the point of use and fail with an actionable message. Frontend `VITE_*` values are public at runtime and must never be treated as a mechanism for hiding secrets.

## Deployment and rollback

The deployment workflow uses least-privilege permissions and separates build/publish from provider deployment. The production environment is protected by reviewers and branch restrictions.

Before deployment:

- validate the release commit and image digest;
- preserve the previous deployment/release identifier;
- verify provider credentials are present.

After deployment:

- poll the API health endpoint;
- poll the frontend URL;
- optionally run a lightweight authenticated smoke check using non-production test data;
- treat timeout, non-2xx status, or malformed health responses as failure.

Rollback is automatic for deployment and health-check failures, and can also be triggered manually. It restores the saved previous Vercel deployment and Render release/image. If rollback itself fails, the workflow must fail loudly, preserve logs, and notify the operator with links to the run and provider dashboards. Database migrations are out of scope for automatic rollback unless a reversible migration strategy is added separately.

## Notifications

Notifications use a GitHub Environment secret such as `DISCORD_WEBHOOK_URL` and do not include credentials or sensitive environment values. Messages include repository, branch, commit, workflow run URL, environment, result, and rollback status. Notification failure must be visible in the workflow but must not mask the primary deployment result.

## Testing and acceptance

Validation will be performed in this order:

1. frozen dependency installation;
2. formatter, lint, typecheck, unit tests, and React Doctor;
3. Docker image build for API and web targets;
4. Docker Compose boot, health checks, endpoint probes, log capture, and cleanup;
5. CodeQL, dependency review, audit, and Sonar analysis;
6. workflow syntax/action validation where available;
7. deployment workflow dry-run or provider-backed staging verification when credentials are available.

The final implementation must state which provider-backed checks could not be run locally because they require GitHub or deployment-provider secrets.

## Documentation

Create `docs/CICD.md` with:

- workflow map and trigger rules;
- local development and Compose verification commands;
- required repository/environment variables and secrets;
- staging and production release procedure;
- health-check and rollback runbooks;
- notification setup;
- dependency and React Doctor maintenance process;
- CodeQL/Sonar maintenance;
- troubleshooting and ownership guidance.

## Out of scope

- Changing the application deployment providers;
- introducing a new cloud orchestrator;
- storing secrets in the repository;
- automatic database schema rollback;
- unrelated application refactors or feature changes.
