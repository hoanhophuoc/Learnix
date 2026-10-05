# Production CI/CD Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Learnix dependencies and pnpm, remove actionable React Doctor issues, verify the Docker Compose stack, and deliver secure GitHub Actions CI/CD with Vercel/Render deployment, notifications, rollback, and operations documentation.

**Architecture:** Keep CI, security/quality, and deployment as separate workflows with reusable setup/notification helpers. Build immutable SHA-tagged images, deploy the existing Vercel frontend and Render API through protected GitHub Environments, probe both services after deployment, and roll back to captured previous release identifiers on failure.

**Tech Stack:** pnpm 12.9.1, Turborepo, Node 24, React/Vite, NestJS, Docker Compose, GitHub Actions, CodeQL, SonarCloud/SonarQube, GHCR, Vercel, Render, Discord webhooks.

**Spec:** [2026-10-05-production-cicd-design.md](/home/phuochoan/Projects/Learnix/docs/superpowers/specs/2026-10-05-production-cicd-design.md)

## Global Constraints

- pnpm is upgraded to the current requested release (12.9.1) now, while CI setup must resolve the current supported pnpm release from repository/tooling policy rather than permanently hard-coding 12.9.1.
- The existing deployment targets are Vercel for the frontend and Render for the API.
- Docker Compose is the local production-like smoke-test environment, not the production runtime.
- Provider-specific rollback APIs and credentials must fail explicitly when required configuration is absent; workflows must not silently report a successful deployment.
- Secrets are supplied through GitHub Secrets or the deployment provider's secret store. Example files contain placeholders only.
- Frontend `VITE_*` values are public at runtime and must never be treated as a mechanism for hiding secrets.
- Database migrations are out of scope for automatic rollback unless a reversible migration strategy is added separately.
- Existing uncommitted modernization changes are intentional and must be integrated rather than discarded.

## Review Focus

- Missing `.env` files must not prevent a basic Compose boot; test the optional configuration path in the Compose smoke test.
- A deployment health check returning a non-2xx response or timing out must fail the deployment and invoke rollback; cover both API and frontend probes.
- Missing provider credentials or rollback identifiers must fail explicitly rather than producing a success-shaped result; add workflow validation steps.
- Mutable image tags must not be used as the rollback source; assert that the deploy workflow passes the commit SHA/digest and preserves the previous release.
- Notification failure must remain visible without masking the primary build/deployment result; cover notification steps with `continue-on-error` and a logged failure.

---

### Task 1: Modernize dependencies, pnpm, and React Doctor

**Files:**

- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/src/**` for actionable React Doctor fixes
- Modify: `apps/web/doctor.config.ts` only for documented intentional exceptions
- Test: existing workspace tests and React Doctor command output

**Interfaces:**

- Consumes: current workspace manifests and existing uncommitted modernization changes.
- Produces: a frozen-installable dependency graph, pnpm 12.9.1 local toolchain, and a React Doctor check that reports no actionable unapproved findings.

- [ ] **Step 1: Record the current dependency and diagnostic baseline**

  Run:

  ```bash
  pnpm --version
  npx npm-check-updates
  pnpm --filter @repo/web doctor
  ```

  Save the command output outside the repository if needed; do not commit generated reports or secrets.

- [ ] **Step 2: Upgrade pnpm and dependency manifests**

  Use pnpm 12.9.1 for the upgrade operation. Run `npx npm-check-updates -u` for the root and workspace manifests, review major-version changes for compatibility, and regenerate `pnpm-lock.yaml` with the repository's pnpm workspace.

  Keep the manifest's current package-manager policy consistent with the no-permanent-12.9.1-CI requirement. CI setup must resolve the supported current pnpm release from repository/tooling policy rather than hard-code `12.9.1` in every workflow.

- [ ] **Step 3: Run React Doctor and write focused fixes**

  Run `npx react-doctor@latest` in `apps/web`. For each actionable finding, modify the smallest owning component/hook, preserving existing behavior. Do not turn a finding into a broad rule suppression. Any remaining suppression in `apps/web/doctor.config.ts` must have a nearby reason in the plan handoff or operations documentation.

- [ ] **Step 4: Verify the workspace modernization**

  Run:

  ```bash
  pnpm install --frozen-lockfile
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  pnpm --filter @repo/web doctor
  ```

  Expected: all commands exit 0; React Doctor has no actionable findings outside documented intentional exceptions.

- [ ] **Step 5: Commit the modernization**

  ```bash
  git add package.json apps/api/package.json apps/web/package.json pnpm-lock.yaml apps/web/src apps/web/doctor.config.ts
  git commit -m "chore: modernize dependencies and react diagnostics"
  ```

### Task 2: Harden Docker and verify Docker Compose

**Files:**

- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.dockerignore`
- Modify: `apps/api/src/**` only if the existing health endpoint contract needs a focused fix
- Test: Docker image builds and Compose smoke-test commands

**Interfaces:**

- Consumes: Task 1's frozen dependency graph and workspace build scripts.
- Produces: `APP_NAME=api` and `APP_NAME=web` images that run as non-root services, plus a Compose stack with healthy PostgreSQL, API, and frontend services.

- [ ] **Step 1: Define the container acceptance probes**

  Confirm the API probe is `GET /health` on port 3000 and the frontend probe is `GET /` on the mapped frontend port. If either endpoint is not present, add the smallest application change and a focused test before changing Compose.

- [ ] **Step 2: Update the Dockerfile**

  Keep the multi-stage build, explicit `APP_NAME`, non-root runner, and build-time `VITE_API_URL`. Replace shell-form startup with an exec-compatible startup strategy that preserves the API/web selection and forwards termination signals. Keep production runtime dependencies minimal.

- [ ] **Step 3: Harden Compose configuration**

  Make local `.env` inputs optional for basic boot, define healthchecks and `depends_on` conditions, mount schema/seed initialization assets only where appropriate, and keep development defaults non-production. Ensure API and frontend healthchecks use tools available in their images.

- [ ] **Step 4: Build both image targets**

  Run:

  ```bash
  docker build --build-arg APP_NAME=api --tag learnix-api:local .
  docker build --build-arg APP_NAME=web --build-arg VITE_API_URL=http://localhost:3000 --tag learnix-web:local .
  ```

  Expected: both builds exit 0 without requiring secret values.

- [ ] **Step 5: Run the Compose smoke test**

  Run:

  ```bash
  docker compose up -d --build
  docker compose ps
  curl --fail --retry 12 --retry-delay 5 http://localhost:3000/health
  curl --fail --retry 12 --retry-delay 5 http://localhost:5173/
  docker compose logs --no-color
  docker compose down -v
  ```

  Expected: all services become healthy, both probes return success, and cleanup runs even when a probe fails. Capture service logs on failure.

- [ ] **Step 6: Commit container changes**

  ```bash
  git add Dockerfile docker-compose.yml .dockerignore apps/api/src
  git commit -m "build: harden containers and compose smoke test"
  ```

### Task 3: Build reusable CI setup and quality gates

**Files:**

- Create or modify: `.github/actions/setup-node-pnpm/action.yml`
- Create or modify: `.github/actions/notify/action.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/reusable-ci.yml`
- Modify: `package.json` only if a missing root validation script is needed
- Test: local YAML/action validation and CI commands

**Interfaces:**

- Consumes: Task 1's package-manager policy and Task 2's container commands.
- Produces: reusable setup with pnpm-store caching, CI jobs for format/lint/typecheck/test/React Doctor/build, Docker image validation, Compose smoke testing, and failure artifacts.

- [ ] **Step 1: Define dynamic pnpm setup**

  In `.github/actions/setup-node-pnpm/action.yml`, install Node 24, enable the repository-supported pnpm resolution strategy, configure pnpm store caching keyed by the lockfile, and run `pnpm install --frozen-lockfile`. Do not duplicate a permanent `12.9.1` literal across workflows.

- [ ] **Step 2: Add the reusable notification action**

  Define inputs for `status`, `environment`, `message`, and `webhook-url`. Send repository, commit, workflow-run URL, environment, and result without secret values. Mark the webhook call non-blocking while emitting a visible warning on failure.

- [ ] **Step 3: Harden CI workflow triggers and permissions**

  Update `.github/workflows/ci.yml` for pull requests, protected branch pushes, and path coverage for manifests, Docker, database assets, and workflow/action changes. Keep `contents: read`, concurrency cancellation, and least-privilege job permissions.

- [ ] **Step 4: Add quality-gate jobs**

  Ensure CI runs formatting, API/web lint, typecheck, unit tests, builds, and React Doctor. Use reusable setup and cache keys. Upload coverage, test results, and Compose logs with `if: failure()` or `if: always()` as appropriate.

- [ ] **Step 5: Add Docker validation and Compose smoke jobs**

  Build both image targets in CI. Run the Compose stack with a cleanup trap, wait for health, probe both endpoints, and upload logs on failure. Do not use deployment secrets in this job.

- [ ] **Step 6: Validate workflow syntax and commands**

  Run a YAML/action linter available in the repository or local environment, then run the same package commands locally. Expected: no malformed workflow expressions and all quality gates pass.

- [ ] **Step 7: Commit CI changes**

  ```bash
  git add .github/actions .github/workflows/ci.yml .github/workflows/reusable-ci.yml package.json
  git commit -m "ci: add cached quality and container gates"
  ```

### Task 4: Add advanced security and Sonar quality analysis

**Files:**

- Modify: `.github/workflows/security.yml`
- Modify: `.github/workflows/build.yml` or remove it if its responsibilities are consolidated without duplicate scans
- Modify: `sonar-project.properties`
- Create or modify: `.github/codeql/config.yml` only if custom paths/query configuration is needed
- Test: workflow validation and provider-backed scans when credentials are available

**Interfaces:**

- Consumes: Task 3's setup/caching conventions and CI artifacts.
- Produces: PR/branch/scheduled CodeQL, dependency review, pnpm audit, and Sonar analysis with clear failure policy.

- [ ] **Step 1: Configure CodeQL**

  Use the maintained CodeQL action major version, JavaScript/TypeScript language, `security-and-quality` queries, least-privilege security-event permissions, and a matrix only where it adds coverage. Ensure checkout history is sufficient for analysis and do not run untrusted PR code with write credentials.

- [ ] **Step 2: Configure dependency review and audit**

  Run dependency review on pull requests with high severity failure policy. Run pnpm audit against the workspace lockfile with a documented high/critical policy; do not hide failures with unconditional success-shaped output.

- [ ] **Step 3: Configure Sonar analysis**

  Set sources, exclusions, test paths, coverage report paths, encoding, and the existing project key/organization in `sonar-project.properties`. Cache Sonar analyzer data and require `SONAR_TOKEN` only in provider-backed jobs.

- [ ] **Step 4: Add security summary and failure notification**

  Summarize each scan result in the job summary and invoke the reusable notification action for failures without exposing tokens.

- [ ] **Step 5: Verify security workflow configuration**

  Run workflow syntax validation and, where credentials are available, execute CodeQL/Sonar on a branch. Expected: findings fail according to policy and are visible in GitHub/Sonar rather than being swallowed.

- [ ] **Step 6: Commit security changes**

  ```bash
  git add .github/workflows/security.yml .github/workflows/build.yml sonar-project.properties .github/codeql
  git commit -m "ci: add codeql and sonar security gates"
  ```

### Task 5: Implement Vercel/Render delivery, health checks, notifications, and rollback

**Files:**

- Create: `.github/workflows/deploy.yml`
- Modify: `.github/actions/notify/action.yml`
- Create: `scripts/ci/validate-required-env.sh`
- Create: `scripts/ci/check-deployment-health.sh`
- Test: shell-script tests or deterministic dry-run fixtures; provider-backed staging run when credentials are available

**Interfaces:**

- Consumes: Task 2 image targets and health endpoints, Task 3 notification action, and Task 4 required-check results.
- Produces: deploy workflow inputs for `environment`, `image-digest`, `previous-vercel-deployment`, and `previous-render-release`, plus explicit rollback and notification behavior.

- [ ] **Step 1: Define required deployment inputs and environment contract**

  Document and validate the exact environment-scoped values: Vercel token/org/project identifiers and frontend URL; Render API key/service ID and API URL; GHCR permissions; Discord webhook; and any public `VITE_API_URL`. Fail before deployment when a required value is absent.

- [ ] **Step 2: Capture the previous known-good release**

  Before changing either provider, query the provider APIs/CLIs and persist the exact previous Vercel deployment identifier and Render release/image identifier as job outputs or an artifact. Never use `latest` as the rollback source.

- [ ] **Step 3: Build and publish the immutable image**

  Build the API image with Buildx, generate provenance/SBOM where supported, publish a commit-SHA tag to GHCR, and expose the resulting digest to the deployment job. Grant `packages: write` only to the publish job.

- [ ] **Step 4: Deploy staging and production**

  Use protected GitHub Environments and deploy the frontend to Vercel and API to Render. Production runs only after required checks and environment approval. Manual dispatch must accept an explicit environment and release reference.

- [ ] **Step 5: Implement post-deployment health checks**

  Poll the API `/health` URL and frontend `/` URL with bounded retries and timeouts. Return failure for network errors, timeout, non-2xx responses, or malformed health responses.

- [ ] **Step 6: Implement rollback**

  On deployment or health-check failure, restore the captured Vercel deployment and Render release/image. If rollback fails, preserve logs, set the job failed, and emit a high-priority notification containing only safe identifiers and run/provider links.

- [ ] **Step 7: Send success/failure notifications**

  Notify only after health checks pass for success. Notify failure and rollback status in `always()` paths; notification errors remain visible but do not replace the primary result.

- [ ] **Step 8: Verify delivery behavior**

  Run scripts against local fixtures for missing values, timeout, non-2xx, and successful probes. Execute a provider-backed staging deployment if credentials are available; otherwise record the exact unverified provider operations in the final documentation.

- [ ] **Step 9: Commit delivery changes**

  ```bash
  git add .github/workflows/deploy.yml .github/actions/notify scripts/ci
  git commit -m "ci: add protected deployment and rollback flow"
  ```

### Task 6: Document operations and perform final acceptance

**Files:**

- Create: `docs/CICD.md`
- Modify: `README.md` only for links or corrected local commands
- Modify: `.env.example` files only for documented non-secret variables
- Test: command snippets and final repository acceptance checks

**Interfaces:**

- Consumes: all prior workflow, environment, health-check, and rollback contracts.
- Produces: the maintainer runbook and final evidence of local acceptance.

- [ ] **Step 1: Document workflow triggers and ownership**

  Add a workflow map covering CI, security, deployment, schedules, branch protection, required checks, and notification ownership.

- [ ] **Step 2: Document environment and secret setup**

  List development/staging/production variables and secrets by scope and purpose. State explicitly that secrets must be configured in GitHub Environments/provider stores and that `VITE_*` values are public.

- [ ] **Step 3: Document release and rollback runbooks**

  Include local Compose verification, staging promotion, production approval, health-check interpretation, manual rollback, automatic rollback limits, and provider dashboard links/placeholders.

- [ ] **Step 4: Document maintenance**

  Explain dependency upgrades, pnpm current-version policy, React Doctor remediation, action version updates, CodeQL/Sonar maintenance, cache invalidation, and notification testing.

- [ ] **Step 5: Run final acceptance**

  Run:

  ```bash
  pnpm install --frozen-lockfile
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  docker compose up -d --build
  docker compose ps
  curl --fail http://localhost:3000/health
  curl --fail http://localhost:5173/
  docker compose down -v
  git diff --check
  git status --short
  ```

  Expected: all local checks pass; provider-backed checks are either successful or explicitly listed as unavailable because credentials/platform access were not present.

- [ ] **Step 6: Commit documentation and acceptance updates**

  ```bash
  git add docs/CICD.md README.md apps/api/.env.example apps/web/.env.example
  git commit -m "docs: add CI/CD operations runbook"
  ```
