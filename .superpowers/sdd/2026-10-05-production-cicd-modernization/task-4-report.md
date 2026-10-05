# Task 4 report: advanced security and Sonar quality analysis

## Status

Implemented and committed as `ci: add codeql and sonar security gates`.

## Changes

- Reworked `.github/workflows/security.yml`:
  - Added pull-request dependency review with high-severity failure policy and denied GPL-3.0/AGPL-3.0 licenses.
  - Configured CodeQL JavaScript/TypeScript analysis with the maintained v3 action major, `security-and-quality` queries, shallow-history protection (`fetch-depth: 2`), and job-level least-privilege permissions.
  - Replaced the non-blocking per-project npm audit jobs with a blocking workspace `pnpm audit --audit-level=high` job using the shared Node/pnpm setup and frozen lockfile install.
  - Consolidated Sonar analysis into the security workflow, gated by the `SONAR_ENABLED` repository variable and requiring `SONAR_TOKEN` only in that provider-backed job.
  - Added Sonar analyzer caching, API coverage generation at the existing `apps/coverage/lcov.info` CI artifact path, an explicit non-empty coverage check, per-job summaries, an aggregate security summary, and failure notification through the existing notification action.
  - Added a trusted-repository guard to CodeQL so fork pull requests skip the build/autobuild/analyze job entirely; trusted same-repository pull requests and non-PR events retain analysis.
  - Notification secrets are passed only through environment/input contexts and are never written to summaries or logs.
- Removed `.github/workflows/build.yml` to avoid running the Sonar scan twice.
- Completed `sonar-project.properties` with the existing project key/organization, source/test paths, exclusions, UTF-8 encoding, and API/Web lcov report paths.

## Validation

- Security workflow YAML parsed successfully and required jobs were present.
- `pnpm exec prettier --check .github/workflows/security.yml` passed.
- Sonar property key/value validation passed.
- `git diff --check` passed.
- `pnpm audit --audit-level=high` ran against the workspace lockfile and failed as intended because existing high/critical advisories are present; the workflow preserves this failure rather than swallowing it.
- The initial coverage probe using `pnpm --filter @repo/api test:cov -- --runInBand` failed because pnpm forwarded the separator to Jest. The direct `pnpm --filter @repo/api exec jest --coverage --runInBand` probe then failed on the repository's existing ESM/Nest Jest loading configuration; the workflow uses the established CI-compatible `cross-env NODE_OPTIONS='--experimental-vm-modules --localstorage-file=.jest-localstorage'` invocation instead.
- `pnpm --filter @repo/api exec cross-env NODE_OPTIONS='--experimental-vm-modules --localstorage-file=.jest-localstorage' jest --coverage --runInBand` passed: 21 suites and 271 tests passed, and `apps/coverage/lcov.info` was non-empty.
- Workflow/config validation passed: YAML parsed, the CodeQL trusted-repository guard and exact Sonar coverage path were asserted, Prettier passed for `security.yml`, and `git diff --check` passed.

## Provider availability

Provider scans may be unavailable locally: `actionlint` is not installed locally, and GitHub CodeQL/Sonar provider-backed execution requires GitHub Actions/provider credentials that are not available in this local environment.
