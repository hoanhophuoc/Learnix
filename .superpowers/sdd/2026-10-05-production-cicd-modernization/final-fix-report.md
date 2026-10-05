# Final CI/CD Fix Report

Fix commit: `133e7463ab97c897f3706e1d49b0c32f1611ed0a`

## Changed files

- `.github/workflows/deploy.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/security.yml`
- `scripts/ci/test-deployment-scripts.sh`
- `docs/CICD.md`

## Final-review resolutions

1. **Render credentials** — Every Render API request now uses the
   environment-scoped `RENDER_API_KEY` bearer header. The key is passed through
   the process environment and is not echoed, interpolated into logs, or
   replaced by a placeholder.
2. **Required checks** — The deployment gate now queries both `ci.yml` and
   `security.yml` for a run with the exact deployment SHA and push event. A
   missing run or any conclusion other than `success` fails with an
   actionable workflow-specific error.
3. **Actions permissions** — `actions: read` is scoped to the deployment
   required-check lookup job. The security workflow no longer grants that
   permission to CodeQL.
4. **Vercel target isolation** — Production captures and deploys the
   production target and may use production promotion for rollback. Staging
   captures preview deployments, deploys without `--prod`, assigns the
   environment-scoped staging alias, and rolls back through that alias. It
   cannot promote a staging deployment to production.
5. **GHCR image naming** — The GitHub owner/repository image path is
   normalized with Bash lowercase expansion before GHCR publication and Render
   image deployment.
6. **CI status strictness** — `ci-status` now requires every required job to
   be `success`. E2E is the only permitted `skipped` result, representing its
   intentional non-PR condition; all other states fail the status job.

## Verification

- `python3` PyYAML parse of all `.github/workflows/*.yml`: passed.
- `pnpm exec prettier --check .github/workflows/ci.yml .github/workflows/security.yml .github/workflows/deploy.yml docs/CICD.md`: passed.
- `shellcheck scripts/ci/test-deployment-scripts.sh scripts/ci/check-deployment-health.sh scripts/ci/validate-required-env.sh`: passed.
- `bash -n scripts/ci/test-deployment-scripts.sh scripts/ci/check-deployment-health.sh scripts/ci/validate-required-env.sh`: passed.
- `scripts/ci/test-deployment-scripts.sh`: passed, including missing-value,
  success, non-2xx, timeout, authorization, target, permissions, exact-SHA,
  image-path, rollback, and CI-status contract assertions.
- `git diff --check -- .github/workflows scripts/ci docs/CICD.md`: passed.

## Provider limitations

No live GitHub, Vercel, Render, GHCR, or Discord provider calls were made.
Those operations require environment credentials, protected-environment
approval, and provider-side state. The provider-backed staging deployment,
rollback, and notification delivery remain unverified locally; the workflow
now fails explicitly when required provider values or verified prior releases
are unavailable.
