# Task 6 report: CI/CD operations runbook and final acceptance

## Status

Documentation is complete. Added
[`docs/CICD.md`](/home/phuochoan/Projects/Learnix/docs/CICD.md) and made no
changes to `README.md` or either environment example because the existing
local commands and documented variables already matched the implemented
contracts.

The runbook records:

- CI, reusable CI, security, and protected deployment triggers, gates, branch
  protection expectations, and ownership;
- development, staging, and production variables/secrets, including the
  public nature of `VITE_*` values and the Vercel project build-setting
  requirement;
- Compose verification, staging promotion, production approval, provider
  health-check interpretation, provider-dashboard/API manual rollback, and
  automatic rollback limits;
- Vercel, Render, GitHub, and Sonar dashboard links/placeholders;
- dependency, pnpm, React Doctor, action, CodeQL/Sonar, cache, and notification
  maintenance;
- troubleshooting guidance and the boundary between local and
  provider-backed verification.

The documentation is based on the implemented contracts from Tasks 1–5:
path-filtered CI with reusable project gates and Compose smoke tests; security
review, CodeQL, pnpm audit, optional Sonar, and notification jobs; and
immutable GHCR deployment with protected GitHub Environments, Vercel/Render
probes, verified previous-release capture, provider rollback, and diagnostic
artifacts.

## Local acceptance

Passed:

- `pnpm install --frozen-lockfile` (`pnpm@12.9.1`);
- `pnpm format:check`;
- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm test`;
- `pnpm build`;
- `bash scripts/ci/test-deployment-scripts.sh`;
- `bash -n scripts/ci/*.sh`;
- `git diff --check`.

The build reported the existing Vite warning about chunks larger than 500 kB
but completed successfully.

The requested Compose command was attempted:

```text
docker compose up -d --build
```

The Docker daemon and classic builder were present, but the environment could
not create the container network endpoint:

```text
failed to set up container networking:
failed to create endpoint ... on network bridge:
failed to add the host (veth...) <=> sandbox (...) pair interfaces:
operation not supported
```

The command therefore could not reach `docker compose ps`, the local API and
frontend curls, or a full stack lifecycle. `docker compose down -v` was run
afterward for cleanup. This is an environment/kernel networking limitation,
not a repository test result.

## Provider-backed verification limits

No GitHub Actions run, GitHub Environment approval, GHCR publication,
provenance/SBOM verification, Vercel deployment or promotion, Render
image-backed deployment or rollback, Sonar provider scan, CodeQL provider
scan, or Discord delivery was attempted locally. Those checks require
provider credentials and platform access and remain the responsibility of the
first authorized workflow run.

## Concerns

- Automatic rollback covers provider releases only; database migrations and
  external side effects remain outside rollback scope.
- The deployment workflow's rollback inputs are automatic-rollback targets,
  not a rollback-only dispatch mode. `VITE_API_URL` must be configured in the
  Vercel project environment/build settings because `deploy.yml` validates
  `PUBLIC_VITE_API_URL` but does not inject it into the Vercel build.
- The deployment workflow requires the Render service's image host,
  repository, and image name to match the immutable GHCR reference.
- The Docker smoke check remains unverified in this environment until it is
  rerun on a host with functional container networking.
