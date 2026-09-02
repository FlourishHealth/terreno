# CircleCI (Terreno)

CircleCI CI/CD source of truth. See
[`docs/implementationPlans/migrate-cicd-to-circleci.md`](../implementationPlans/migrate-cicd-to-circleci.md).

**Status:** CircleCI owns package CI, repo policies, Playwright e2e, Maestro web
e2e, architectural PR review, and semver-tag npm releases. Path filters start
CircleCI Netlify and GCP production/preview jobs, but those jobs **skip green**
until `terreno-netlify` and `terreno-gcp` are filled. GitHub Actions still
owns live Netlify/GCP deploys in this window. Do not leave both applying
terraform once CircleCI GCP deploys succeed — set the GHA deploy workflows
back to `on: []` in the same change. GitHub-native security, Cursor GitHub App
checks (Approval / Security / Bugbot), and repository automation remain
enabled. EAS PR updates and the fingerprint gate are temporarily disabled;
manual EAS development dispatch remains available in CircleCI. Preview
**cleanup** on PR close is GitHub `preview-cleanup.yml` plus the manual
CircleCI `run-preview-cleanup` parameter.

## Project setup (maintainers)

1. Link `FlourishHealth/terreno` in CircleCI (GitHub App).
2. Default branch: `master`.
3. Enable **dynamic config** / setup workflows for the project (required for
   `.circleci/config.yml` `setup: true`).
4. Create the contexts below (`terreno-netlify`, `terreno-gcp`, and the rest).
   Copy Netlify and GCP values from GitHub Actions secrets/vars. Until they
   are set, CircleCI deploy jobs skip with exit 0 and GHA remains the live
   deployer.
5. Build forked PRs if you want DCO + rulesync on forks.

GitHub App org/project slug (API and CLI):
`circleci/6UHiK7pThPXbhnNi3umQNe/W3HZeMJujyMB2sYiUXaQbs`.

Do not query `gh/FlourishHealth/terreno` — that slug returns `404 Project not found`.
Cloud agents use `CIRCLECI_TOKEN` (accepted alias of CircleCI's `CIRCLE_TOKEN`). Send
it as the `Circle-Token` header. Confirm with `GET https://circleci.com/api/v2/me`, then
list pipelines on the slug above.

## Config layout

| File | Role |
|------|------|
| `.circleci/config.yml` | Setup workflow + `path-filtering` (this is the live config) |
| `.circleci/continue-config.yml` | Real jobs/workflows gated by those params |

Smoke job `config-ok` and fork-only `dco` always run on continuation.
`rulesync-check` runs only when generated-rule sources change (`run-rulesync`).
`admin-backend/**` starts `admin-backend-ci`; `admin-frontend/**` starts
`admin-frontend-ci`. Both jobs lint, compile, and run `test:coverage`.

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

## Automatic deploys

Path filters set `run-deploy-*` and `run-cd-*`. Production jobs run only on
`master`. Preview jobs run on PRs from this repository and skip forks and
non-PR branch builds.

| Path (examples) | Parameter | PR job | `master` job |
| --- | --- | --- | --- |
| `demo/**`, `ui/**` | `run-deploy-demo` | `deploy-demo-preview` | `deploy-demo` |
| `example-frontend/**`, `admin-frontend/**`, `rtk/**` | `run-deploy-frontend` | `deploy-frontend-preview` | `deploy-frontend` |
| `docs/**`, `website/**` | `run-deploy-docs` | `deploy-docs-preview` | `deploy-docs` |
| `example-backend/**`, `api/**`, `comms/**` | `run-cd-backend` | `gcp-cd-preview` | `gcp-cd-prod` |
| `terraform/**` | `run-cd-terraform` | `gcp-cd-preview` | `gcp-cd-prod` |
| `mcp-server/**` | `run-cd-mcp` | _(none)_ | `gcp-cd-prod` |

Until `terreno-netlify` is populated, GitHub Actions `docs-deploy` /
`demo-deploy` / `frontend-example-deploy` publish the live sites (including
PR aliases). CircleCI `deploy-*-preview` jobs still start from path filters
and skip when `NETLIFY_AUTH_TOKEN` or the site id is missing. The same skip
applies to `gcp-cd-*` when `terreno-gcp` lacks WIF or SA emails, so GitHub
`cd.yml` remains the live GCP writer. GitHub `terraform-preview` and
`backend-deploy-preview` run only when
`github.event.pull_request.head.repo.full_name == github.repository`. Fork
PRs still present `repository: FlourishHealth/terreno` on the OIDC token, so
WIF would accept them if those jobs ran. Netlify GHA jobs fail closed on
forks (secrets withheld). After filling a context, confirm a CircleCI deploy
URL, then set the matching GHA workflows to `on: []`. Turn off Netlify's
GitHub auto-build so only one system publishes.

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

The Netlify deploy helper validates its context before building, and the docs
target disables Docusaurus minification for preview and production builds to
remain within the available 8 GB CircleCI executor.

`terreno-gcp` uses CircleCI OIDC (`CIRCLE_OIDC_TOKEN_V2`), never a JSON service
account key. Set `circleci_org_id`, `circleci_project_id`, and
`circleci_gcp_context_id` in `terraform/terraform.tfvars`, apply once with an
existing Terraform admin identity, then copy `circleci_workload_identity_provider`
into the context as `GCP_WIF_PROVIDER_PROD`. The WIF condition requires the
`terreno-gcp` context UUID so a PR job without that context cannot exchange the
ambient OIDC token for GCP impersonation.

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
| _(new)_ Admin backend lint, compile, coverage | `admin-backend-ci` |
| _(new)_ Admin frontend lint, compile, coverage | `admin-frontend-ci` |
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
| Netlify PR preview | `deploy-demo-preview`, `deploy-frontend-preview`, `deploy-docs-preview` |
| GCP production | `gcp-cd-prod` |
| GCP PR preview | `gcp-cd-preview` |
| npm semver tag | `publish-release` |

CD replacement map:

| GHA job `name:` / workflow (not yet ported) | Planned CircleCI job |
|---------------------------------------------|----------------------|
| Fingerprint gate (`fingerprint-gate.yml`) | Temporarily disabled; no CircleCI automatic gate |
| EAS PR update/build (`eas-pr.yml`) | Temporarily disabled; use manual EAS dispatch |
| EAS dev build (`eas-dev-build.yml`) | CircleCI manual `eas-dev-target` |
| CD terraform / Cloud Run (`cd.yml`) | `gcp-cd-prod` (master) and `gcp-cd-preview` (PRs) |
| Preview cleanup (`preview-cleanup.yml`) | CircleCI manual `run-preview-cleanup` |
| Netlify demo / frontend / docs deploys | production + `*-preview` jobs |
| Publish on tag (`publish-on-tag.yml`) | `publish-release` |
| Appium Android / iOS | Not ported (Maestro web is `maestro-e2e`) |

## Manual pipelines

Trigger a pipeline from the CircleCI UI/API on the ref containing the code to
operate. Set exactly one operation per pipeline.

Netlify and GCP operations require the contexts in the table above. Path filters
start production deploys on `master` and PR previews on other branches
automatically. Use the manual parameters to force a deploy or to clean up after
a closed PR.

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
Only stable tags (`57.3.0`) run `deploy-demo` after publish. Use
`{"run-demo-deploy":true}` on `master` if a prerelease must also refresh the
demo site.

PR preview **cleanup** is manual because CircleCI does not receive GitHub
`pull_request.closed` events. Configure a GitHub App/webhook to call
`run-preview-cleanup` if automatic lifecycle cleanup is required. Path-filtered
preview **deploys** run on open PRs from this repository; fork PRs are skipped.
If `CIRCLE_PULL_REQUEST` is unset (GitHub App `push` pipelines), the job looks
up the open PR for `CIRCLE_BRANCH` via the GitHub API.

## Path-filter parity guard

`bun run check:circleci-parity` guards active GitHub/CircleCI twins. Deploy
workflows are dual-run until CircleCI contexts are filled; they are not in
the parity mapping. New CircleCI-only path rules still belong in
`.circleci/config.yml` and config tests. The checker prefers live `config.yml`
when `setup: true`.

## Config-only changes

Edits to `.circleci/config.yml` / `continue-config.yml` /
`example-frontend/playwright.circleci.config.ts` set `run-circleci-config`.
When no package/e2e path param is also set, that workflow runs the slice above.
CircleCI e2e compiles the workspace and `bun expo export`s **once** in
`e2e-prepare`, then shards attach that dist (60s test timeout, `large` Docker).
Keeping Metro alive next to Chromium gets SIGKILL on 8GB. `xlarge` is not on
this project's plan. Chaos e2e treats a hidden Offline banner after `goOnline`
as reconnect — a `client.stop()`/`start()` handshake hung 30s on the static
export. `maestro-e2e` follows the same static-export rule: it exports
example-frontend and serves the static `dist`. If the browsers image has no
Xvfb on `:99`, a `background: true` fallback starts one and keeps it alive
for later steps.

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

Package CI, e2e, and npm tag workflows stay `on: []`. Netlify/GCP deploy
workflows are **re-enabled** until CircleCI contexts have the same secrets.
After a successful CircleCI production or preview deploy, set
`docs-deploy.yml`, `demo-deploy.yml`, `frontend-example-deploy.yml`, `cd.yml`,
and `preview-cleanup.yml` back to `on: []` in the same PR. Never enable both
npm tag publishers. Never leave both GCP terraform applies enabled.

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
