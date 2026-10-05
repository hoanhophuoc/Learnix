# Project: Learnix Monorepo Modernization

## Architecture

Learnix is a full-stack educational monorepo consisting of:

- **Root**: Monorepo workspace configuration (`pnpm-workspace.yaml`, `turbo.json`), tooling (Prettier, Playwright E2E test harness), and Vercel serverless entrypoint (`api/index.ts` connecting to `apps/api/src/app.module`).
- **Frontend (`apps/web`)**: React 19 SPA powered by Vite, Tailwind CSS v4, TanStack Query, React Hook Form, and Tiptap. Runs on port 5173 (dev) or port 3000 (Docker `serve`).
- **Backend (`apps/api`)**: NestJS backend service with Express, TypeORM, PostgreSQL, WebSockets (Socket.IO), and Google GenAI SDK. Compiles via SWC and runs on port 3000.
- **Database**: PostgreSQL with schema and seed data in `/database/`.
- **Containers**: Multi-stage `Dockerfile` (Node 24 Alpine, Turborepo pruned build, serve / node runner) orchestrated via `docker-compose.yml`.
- **CI/CD**: GitHub Actions workflows for formatting, Turborepo quality gates, CodeQL, SonarQube/SonarCloud, GHCR container publishing, Vercel & Render deployments with live healthchecks, automated rollback, and Discord webhook notifications.

## Feature Inventory

| #   | Feature                                   | Description                                                                                                                                                              | Milestone | Source   |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------- |
| 1   | Monorepo Root Upgrades                    | Upgrade root tooling and sync NestJS serverless dependencies with latest compatible releases via `npx npm-check-updates -u`                                              | M1        | Survey 1 |
| 2   | Frontend Dependency Modernization         | Upgrade `apps/web` packages (React 19.3, Vite 8, Vitest 5, Tailwind 4, Lucide, Axios CVE fix)                                                                            | M1        | Survey 1 |
| 3   | Backend Dependency Modernization          | Upgrade `apps/api` packages (NestJS 12, TypeORM 0.3.31/compatible, Nodemailer, SWC)                                                                                      | M1        | Survey 1 |
| 4   | React Doctor Diagnostic Remediation       | Eliminate all 17 errors and 195 warnings from `npx react-doctor@latest` (supply-chain, compiler `finally` blocks, effect cleanups, library compatibility, doctor config) | M1        | Survey 1 |
| 5   | Dockerfile Modernization                  | Update multi-stage Dockerfile: Node 24 Alpine base, libc6-compat in base, APP_NAME argument propagation to runner stage, exec form signal handling                       | M2        | Survey 2 |
| 6   | Docker Compose Hardening                  | Make `.env` files optional (`required: false`), mount database init scripts (`schema.sql`, `seed.sql`), tune postgres start_period                                       | M2        | Survey 2 |
| 7   | Container Healthchecks                    | Add `/health` HTTP probe for backend and `/` HTTP probe for frontend; establish healthcheck dependency chains                                                            | M2        | Survey 2 |
| 8   | Docker Compose Boot Verification          | Verify `docker compose up -d --build` runs `postgres`, `backend`, and `frontend` with healthy status and no crash loops                                                  | M2        | Survey 2 |
| 9   | CI Workflow Hardening                     | Fix non-existent action tags (@v6, @v5 -> verified @v4), fix pnpm lockfile cache hashing, postgres 16 runner, Turborepo quality gates                                    | M3        | Survey 3 |
| 10  | Security Workflow Hardening               | Configure CodeQL (`github/codeql-action@v3`), dependency review, fix matrix paths for `apps/api` and `apps/web`                                                          | M3        | Survey 3 |
| 11  | SonarQube / SonarCloud Integration        | Hardened code quality analysis workflow with token handling and project key configuration                                                                                | M3        | Survey 3 |
| 12  | GHCR Container Publishing                 | Automated multi-platform Docker container build and push to GHCR with commit SHA and latest tags                                                                         | M3        | Survey 3 |
| 13  | Vercel & Render Deployments               | Automated CD steps deploying `apps/web` to Vercel and backend container to Render                                                                                        | M3        | Survey 3 |
| 14  | Post-Deployment Live Healthcheck Probes   | Automated HTTP polling against live endpoints post-deployment                                                                                                            | M3        | Survey 3 |
| 15  | Automated Rollback Mechanics              | Auto-rollback triggers on deployment or healthcheck failure (Vercel deployment rollback & Render deploy rollback API)                                                    | M3        | Survey 3 |
| 16  | Discord Webhook Notifications             | Rich embed notifications for CI/CD events (build failure, deployment success, rollback triggers)                                                                         | M3        | Survey 3 |
| 17  | Operations Documentation (`docs/CICD.md`) | Production-grade operations guide detailing architecture, workflows, dev/staging/prod environments, GitHub Secrets specification, rollback runbooks, and troubleshooting | M4        | Survey 3 |

## Milestones

| #   | Name                                                 | Scope                                                | Dependencies | Status                                                     |
| --- | ---------------------------------------------------- | ---------------------------------------------------- | ------------ | ---------------------------------------------------------- |
| 1   | Dependency Modernization & React Doctor Remediations | F1, F2, F3, F4                                       | none         | IN_PROGRESS (worker: 057f2af3-b21d-4546-8bde-cf13792a39ca) |
| 2   | Containerization & Docker Compose Verification       | F5, F6, F7, F8                                       | M1           | PLANNED                                                    |
| 3   | Hardened CI/CD Workflows & Delivery Pipeline         | F9, F10, F11, F12, F13, F14, F15, F16                | M1, M2       | PLANNED                                                    |
| 4   | Operations Documentation & Acceptance Verification   | F17 (Full Monorepo Acceptance Criteria Verification) | M1, M2, M3   | PLANNED                                                    |

## Interface Contracts

### `apps/web` ↔ `apps/api`

- Protocol: REST HTTP + WebSocket (Socket.IO).
- Ports: Backend listens on port 3000 (endpoints: `/health`, `/api/v1/*`), Frontend listens on port 5173 (dev) or port 3000 (container).
- Healthcheck: `GET /health` returns HTTP 200 `"OK"`.
- Authentication: Cookie-based / JWT header bearer token.

### Monorepo Workspaces ↔ Turborepo

- Standard tasks: `turbo run build`, `turbo run lint`, `turbo run typecheck`, `turbo run test`.
- Package manager: `pnpm@10.27.0`.
- Node engine: `>=24`.

### Docker Compose Services

- `postgres` (port 5432) -> healthy via `pg_isready -U postgres -d learnix`.
- `backend` (port 3000) -> depends on `postgres (service_healthy)`, healthy via `wget --spider http://localhost:3000/health`.
- `frontend` (port 5173 -> 3000) -> depends on `backend (service_healthy)`, healthy via `wget --spider http://localhost:3000/`.

### CI/CD Secrets Contract

- Required GitHub Secrets:
  - `GHCR_TOKEN`: GitHub Container Registry publishing token (or `GITHUB_TOKEN` with write packages permission).
  - `VERCEL_TOKEN`: Vercel CLI deployment and rollback token.
  - `RENDER_API_KEY`: Render REST API authentication key.
  - `RENDER_SERVICE_ID`: Target Render web service ID.
  - `DISCORD_WEBHOOK_URL`: Discord channel webhook URL for rich embeds.
  - `SONAR_TOKEN`: SonarQube / SonarCloud authentication token.

## Code Layout

- `apps/web/**`: Frontend application source, Vite config, Vitest tests, `doctor.config.ts`. Owned by M1.
- `apps/api/**`: Backend application source, NestJS config, TypeORM entities, Jest tests. Owned by M1.
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`: Monorepo configuration. Owned by M1.
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`: Container configuration. Owned by M2.
- `.github/**`: GitHub Actions workflows, composite actions. Owned by M3.
- `docs/CICD.md`: Operations manual. Owned by M4.
- `.agents/teamwork/**`: Metadata and state logs. Orchestrator and agent metadata only.
