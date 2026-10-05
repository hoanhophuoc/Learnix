# Task 3 implementation report

## Delivered

- Updated `.github/actions/setup-node-pnpm/action.yml` to:
  - install Node.js 24;
  - read and validate the root `package.json` `packageManager` field;
  - pass the repository-resolved pnpm version to `pnpm/action-setup`;
  - cache the pnpm store using the root lockfile hash;
  - install the workspace once with `pnpm install --frozen-lockfile`.
- Added `.github/actions/notify/action.yml` with status, environment, message, and webhook inputs. It sends repository, commit, workflow-run URL, environment, result, and message only; webhook errors are visible warnings and do not change the primary result.
- Hardened `.github/workflows/ci.yml` triggers for manifests, database assets, Docker files, and workflow/action changes while retaining read-only contents permissions and concurrency cancellation.
- Added React Doctor, API/web image builds, and a Docker Compose health/endpoint smoke gate. Compose logs are captured on failure and the stack is always cleaned up.
- Updated `.github/workflows/reusable-ci.yml` so tests are captured to a non-empty `test-results/test.log`, an optional coverage command runs after the test step, and coverage/test-result artifacts are uploaded.
- Configured the API reusable job to run Jest coverage with the same ESM Node options as its passing unit-test script.

## Local validation

Passed:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` — API: 21 suites / 271 tests; web: 12 files / 180 tests
- `pnpm build`
- `pnpm --filter @repo/web doctor`
- `docker compose config`
- Targeted Prettier checks for all edited action/workflow files
- Python YAML parsing for both actions and both workflows
- Dynamic package-manager resolution from `package.json` (`12.9.1`)
- `git diff --check`
- `pnpm --filter @repo/web test 2>&1 | tee apps/web/test-results/test.log` — 12 files / 180 tests passed and a non-empty diagnostic log was produced
- `pnpm --filter @repo/api exec cross-env NODE_OPTIONS='--experimental-vm-modules --localstorage-file=.jest-localstorage' jest --coverage` — 21 suites / 271 tests passed and coverage output was generated in `apps/coverage`

Expected local limitation:

- `pnpm format:check` is blocked by the ignored, pre-existing `.superpowers/sdd/2026-10-05-production-cicd-modernization/task-3-brief.md` formatting warning. The edited CI files pass targeted formatting.
- Docker image builds were attempted for both targets, but the local Docker daemon cannot create bridge-network veth interfaces (`operation not supported`). Compose smoke execution therefore could not run locally.
- `actionlint` is not installed locally; workflow/action syntax was checked with the available YAML parser. GitHub-hosted action execution, artifact upload, and webhook delivery require GitHub Actions and were not available locally.

The original `pnpm --filter @repo/api test:cov` script was also checked and fails before coverage because it omits the ESM Node options. The workflow uses the equivalent existing Jest command with those options instead; no package script was changed.

## Commit

The CI changes are committed as:

`ci: add cached quality and container gates` (base)

Round 1 fix commit: `ci: make CI test artifacts actionable`
