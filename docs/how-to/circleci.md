# CircleCI (Terreno)

CircleCI CI/CD source of truth. See
[`docs/implementationPlans/migrate-cicd-to-circleci.md`](../implementationPlans/migrate-cicd-to-circleci.md).

**Status:** CircleCI owns package CI, repo policies, Playwright e2e, Maestro web
e2e, architectural PR review, Netlify production deploys, GCP production deploys,
semver-tag npm releases, and manual preview/EAS/package operations. Matching
GitHub workflows remain in-repo with `on: []` for rollback. GitHub-native
security, Cursor GitHub App checks (Approval / Security / Bugbot), and
repository automation remain enabled. EAS PR updates and the fingerprint gate
are temporarily disabled; manual EAS development dispatch remains available in
CircleCI.

## Project setup (maintainers)

1. Link `FlourishHealth/terreno` in CircleCI (GitHub App).
2. Default branch: `master`.
3. Enable **dynamic config** / setup workflows for the project (required for
   `.circleci/config.yml` `setup: true`).
4. Create the contexts below before merging the CD cutover.
5. Build forked PRs if you want DCO + rulesync on forks.

Org/project slug: _(record after Phase 0.1 — e.g. `flourishhealth/terreno`)_.

## Config layout

| File | Role |
|------|------|
| `.circleci/config.yml` | Setup workflow + `path-filtering` (this is the live config) |
| `.circleci/continue-config.yml` | Real jobs/workflows gated by those params |

Smoke job `config-ok` and fork-only `dco` always run on continuation.
`rulesync-check` runs only when generated-rule sources change (`run-rulesync`).

`.circleci/**` sets `run-circleci-config`. On **config-only** PRs that workflow
runs a representative slice (`api-ci`, `ui-ci`, `example-backend-ci`,
`no-barrel-imports`, `source-rules`, `e2e` spec `login`). If the same pipeline
already set `run-api`, `run-ui`, `run-e2e`, `run-example-backend`, or
`run-admin-spa`, that kitchen-sink workflow is skipped so jobs are not doubled.
`comms/**` also sets `run-example-backend` and `run-example-backend-script`,
matching the GitHub Actions twins.

The example-backend Docker job runs only when its image recipe changes
(`Dockerfile`, `.dockerignore`, package manifests, or `bun.lock`). API/source
changes are covered by preview CD builds and do not start a duplicate image job.

## Contexts (create empty shells, then fill)

Do **not** paste secret values into the repo. Create these CircleCI Contexts and
restrict `terreno-release` and `terreno-npm` to tag/manual release pipelines.

| Context | Maps from GHA | Used by (planned / current) |
|---------|---------------|------------------------------|
| `terreno-npm` | `NPM_TOKEN` | tag + manual package publishing |
| `terreno-netlify` | `NETLIFY_AUTH_TOKEN`, three `NETLIFY_*_SITE_ID` values | Netlify deploys |
| `terreno-expo` | `EXPO_TOKEN` | manual EAS workflows |
| `terreno-gcp` | `GCP_WIF_PROVIDER_PROD`, `GCP_TF_ADMIN_SA_PROD`, `GCP_CD_DEPLOYER_SA_PROD`, optional `GCP_INFRA_MANAGER_LOCATION`, `MCP_SENTRY_DSN` | GCP CD + cleanup |
| `terreno-e2e` | `E2E_TOKEN_SECRET`, `E2E_REFRESH_TOKEN_SECRET`, `E2E_SESSION_SECRET` | `e2e`, `admin-spa-integration`, `maestro-e2e` |
| `terreno-release` | `REPO_ADMIN_TOKEN`, `ZOOM_WEBHOOK_URL`, `ZOOM_WEBHOOK_TOKEN` | stable version bump + release notification |
| `terreno-agentic` | `CURSOR_API_KEY`, optional `CURSOR_MODEL` | `architectural-pr-review` |
| `terreno-github-api` | PAT (`pull-requests`, `contents`, …) | `dco`, `architectural-pr-review` |

Until contexts exist, e2e jobs may use **project env vars for `E2E_*` secrets only**
(or the in-job `ci-e2e-*-secret` fallbacks). **Do not** put `GITHUB_TOKEN` (or any
GitHub PAT) in project env vars — those are injected into every job, including
`bun` scripts from the PR. Create `terreno-github-api`, restrict it to this
project, leave fork-PR secret passing off, and attach that context **only** to
`dco` and `architectural-pr-review`. DCO skips if `GITHUB_TOKEN` is unset.
`architectural-pr-review` also skips if `GITHUB_TOKEN` or `CURSOR_API_KEY` is
unset, and it skips fork PRs. The job checks out `origin/master` before running
the review script so a PR cannot rewrite the reviewer.

`terreno-gcp` uses CircleCI OIDC (`CIRCLE_OIDC_TOKEN_V2`), never a JSON service
account key. Set `circleci_org_id` and `circleci_project_id` in
`terraform/terraform.tfvars`, apply once with an existing Terraform admin
identity, then copy `circleci_workload_identity_provider` into the context as
`GCP_WIF_PROVIDER_PROD`.

## Check name map (GHA → CircleCI)

Branch protection must require the CircleCI job names below. Remove disabled
GitHub check names or pull requests will wait for checks that can no longer run.

| GHA job `name:` / workflow | CircleCI job |
|----------------------------|--------------|
| Repository policies / No barrel imports | `no-barrel-imports` |
| Repository policies / Production source rules | `source-rules` |
| Explicit any baseline | `explicit-any` |
| License coverage | `license-coverage` |
| Verify rules are in sync | `rulesync-check` |
| `dco` | `dco` |
| Run all tests (API CI) | `api-ci` |
| Run all tests (AI CI) | `ai-ci` |
| RTK Lint and Build | `rtk-ci` |
| Syncdb Lint, Build, and Tests | `syncdb-ci` |
| UI Lint, Build, Types, and Tests | `ui-ci` |
| Demo TypeScript Check (UI dependency) | `ui-demo-typecheck` |
| Demo Lint and TypeScript Check | `ui-demo-ci` |
| Lint, compile, and test communications | `comms-ci` |
| Lint, Build, and Test (MCP) | `mcp-server-ci` |
| Build Docker Image (MCP) | `mcp-server-docker` |
| Example Frontend Lint and Test | `example-frontend-ci` |
| Example Backend Lint, Build, and Test | `example-backend-ci` |
| Run admin script CLI | `example-backend-script-runner` |
| Build backend Docker image | `example-backend-docker` |
| Admin SPA Build and E2E | `admin-spa-ci` |
| E2E · `<spec>` | `e2e` (matrix `spec`) |
| E2E Load · syncdb-loadlab | `e2e-load` (trigger-gated, see below) |
| Admin SPA Backend Integration E2E | `admin-spa-integration` |
| _(new)_ CircleCI path-filter parity | `circleci-parity` |
| _(smoke)_ | `config-ok` |
| _(e2e compile+export once)_ | `e2e-prepare` |
| Architectural PR review | `architectural-pr-review` (non-blocking; skip forks / missing secrets) |
| Maestro E2E Tests | `maestro-e2e` (`include-demo` when ui/demo Maestro flows change) |
| Changelog fragments | `changelog-fragments` |
| New file coverage | `new-file-coverage` |
| Netlify production | `deploy-demo`, `deploy-frontend`, `deploy-docs` |
| GCP production | `gcp-cd-prod` |
| npm semver tag | `publish-release` |

CD replacement map:

| GHA job `name:` / workflow (not yet ported) | Planned CircleCI job |
|---------------------------------------------|----------------------|
| Fingerprint gate (`fingerprint-gate.yml`) | Temporarily disabled; no CircleCI automatic gate |
| EAS PR update/build (`eas-pr.yml`) | Temporarily disabled; use manual EAS dispatch |
| EAS dev build (`eas-dev-build.yml`) | CircleCI manual `eas-dev-target` |
| CD terraform / Cloud Run (`cd.yml`) | `gcp-cd-prod` |
| Preview cleanup (`preview-cleanup.yml`) | CircleCI manual `run-preview-cleanup` |
| Netlify demo / frontend / docs deploys | `deploy-demo`, `deploy-frontend`, `deploy-docs` |
| Publish on tag (`publish-on-tag.yml`) | `publish-release` |
| Appium Android / iOS | Not ported (Maestro web is `maestro-e2e`) |

## Manual pipelines

Trigger a pipeline from the CircleCI UI/API on the ref containing the code to
operate. Set exactly one operation per pipeline:

| Operation | Pipeline parameters |
|-----------|---------------------|
| Force all GCP production CD (use `master`) | `{"run-cd":true}` |
| Force demo production deploy | `{"run-demo-deploy":true}` |
| Deploy backend + Netlify previews | `{"deploy-preview-pr":"1199"}` |
| Remove preview backend tag/database | `{"run-preview-cleanup":"1199"}` |
| Dispatch EAS development builds | `{"eas-dev-target":"both"}` (`example-frontend`, `demo`, or `both`) |
| Publish one package | `{"manual-publish-package":"syncdb","manual-publish-version":"57.3.0"}` |
| Run load test | `{"run-e2e-load":true}` |

`manual-publish-package` also accepts `feature-flags`. Versions must be semver.
Semver git tags (`57.3.0`, `57.3.0-beta.1`) automatically start
`publish-release`; prereleases publish to their prerelease npm dist-tag.

PR previews and cleanup are manual because CircleCI does not receive GitHub
`pull_request.closed` events directly. Configure a GitHub App/webhook to call
these pipeline parameters if automatic lifecycle cleanup is required.

## Path-filter parity guard

`bun run check:circleci-parity` guards active GitHub/CircleCI twins. Disabled
GitHub workflows have `on: []`, so new CircleCI-only path rules must be added
directly to `.circleci/config.yml` and covered by config tests. The checker
prefers live `config.yml` when `setup: true`.

## Config-only changes

Edits to `.circleci/config.yml` / `continue-config.yml` /
`example-frontend/playwright.circleci.config.ts` set `run-circleci-config`.
When no package/e2e path param is also set, that workflow runs the slice above.
CircleCI e2e compiles the workspace and `bun expo export`s **once** in
`e2e-prepare`, then shards attach that dist (60s test timeout, `large` Docker).
Keeping Metro alive next to Chromium gets SIGKILL on 8GB. `xlarge` is not on
this project's plan.

## Nightly load test

`e2e-load` (syncdb-loadlab) is never PR-blocking. Trigger the **setup** pipeline
with `run-e2e-load`. Setup skips path-filtering and continues with a differently
named continuation parameter (`e2e-load`) so CircleCI does not report conflicting
pipeline parameters.

```json
{"run-e2e-load": true}
```

This replaces the GHA cron / `workflow_dispatch` / `load-test` label triggers in
`e2e-load-nightly.yml`. Create a CircleCI schedule with
`{"run-e2e-load":true}` at `0 6 * * *` to retain the nightly run.

## Local validation

```bash
circleci config validate .circleci/config.yml
circleci config validate .circleci/continue-config.yml
```

## Disabled GitHub workflows

Migrated workflow files are retained with `on: []` for rollback. To roll one
back, restore its original trigger block and disable the matching CircleCI
workflow in the same change. Never enable both npm tag publishers.

## Cursor GitHub App checks

Do not try to run these on CircleCI. They are Cursor-hosted GitHub App
automations (dashboard / GitHub App), not workflow files in this repo:

| Check | Why it stays on GitHub |
| --- | --- |
| Cursor Approval Agent: Pull Request Approver | Cursor cloud agent; posts its own GitHub check |
| Cursor Security Agent: Security Reviewer | Same Cursor GitHub App path |
| Cursor Bugbot | Same Cursor GitHub App path |

The in-repo architectural reviewer (`cursor-agent` CLI +
`.github/scripts/architectural-pr-review.ts`) is the job that *can* move, and it
now runs on CircleCI.

## Not in this phase

- Appium (Android emulator / iOS simulator)
- CodeQL, Dependabot auto-merge, triage, gh-aw lockfile agentics
- EAS PR updates and fingerprint acknowledgement
- Cursor Approval / Security / Bugbot GitHub App checks
