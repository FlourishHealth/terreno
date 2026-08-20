# CircleCI (Terreno)

Dual-run migration from GitHub Actions. See
[`docs/implementationPlans/migrate-cicd-to-circleci.md`](../implementationPlans/migrate-cicd-to-circleci.md).

**Status (2026-08-17):** Phase 1–3 config is in-repo (package CI, repo policy, Playwright
e2e). **Deploys are not ported yet** (Netlify, GCP CD, EAS, npm publish). GHA remains
required until CircleCI twins are trusted.

## Project setup (maintainers)

1. Link `FlourishHealth/terreno` in CircleCI (GitHub App).
2. Default branch: `master`.
3. Enable **dynamic config** / setup workflows for the project (required for
   `.circleci/config.yml` `setup: true`).
4. Build forked PRs if you want DCO + rulesync on forks.

Org/project slug: _(record after Phase 0.1 — e.g. `flourishhealth/terreno`)_.

## Config layout

| File | Role |
|------|------|
| `.circleci/config.yml` | Setup workflow + `path-filtering` → sets boolean pipeline params |
| `.circleci/continue-config.yml` | Real jobs/workflows gated by those params |

Smoke job `config-ok` always runs on continuation.

`.circleci/**` sets `run-circleci-config`, which starts the `circleci-config`
workflow: one job from each ported family (package CI, policy, example apps,
`e2e` with `spec: login`, admin-spa). `comms/**` also sets
`run-example-backend` and `run-example-backend-script`, matching the GitHub
Actions twins.

## Contexts (create empty shells, then fill)

Do **not** paste secret values into the repo. Create these CircleCI Contexts and restrict
`terreno-release` to tag/release pipelines when publish is ported.

| Context | Maps from GHA | Used by (planned / current) |
|---------|---------------|------------------------------|
| `terreno-npm` | `NPM_TOKEN` | publish (deferred) |
| `terreno-netlify` | `NETLIFY_*` | deploys (deferred) |
| `terreno-expo` | `EXPO_TOKEN` | EAS (deferred) |
| `terreno-gcp` | OIDC / WIF (no long-lived key for CD) | GCP CD (deferred) |
| `terreno-e2e` | `E2E_TOKEN_SECRET`, `E2E_REFRESH_TOKEN_SECRET`, `E2E_SESSION_SECRET` | `e2e`, `admin-spa-integration` |
| `terreno-release` | `REPO_ADMIN_TOKEN`, Zoom webhooks | publish (deferred) |
| `terreno-agentic` | `CURSOR_API_KEY` | agentic replacements (deferred) |
| `terreno-github-api` | PAT (`pull-requests`, `contents`, …) | `dco`, PR comments later |

Until contexts exist, attach project env vars with the same names, or rely on job
fallbacks (`ci-e2e-*-secret` for e2e; DCO skips if `GITHUB_TOKEN` is unset).

After contexts exist, attach them on the matching jobs in
`.circleci/continue-config.yml` (see comments in the `workflows:` section).

## Check name map (GHA → CircleCI)

Branch protection still requires **GitHub Actions** names during dual-run. CircleCI
checks appear as CircleCI job names in the GitHub Checks UI.

| GHA job `name:` / workflow | CircleCI job |
|----------------------------|--------------|
| Repository policies / No barrel imports | `no-barrel-imports` |
| Explicit any baseline | `explicit-any` |
| License coverage | `license-coverage` |
| Verify rules are in sync | `rulesync-check` |
| `dco` | `dco` |
| Run all tests (API CI) | `api-ci` |
| Run all tests (AI CI) | `ai-ci` |
| RTK Lint and Build | `rtk-ci` |
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

Deferred phases keep their GHA checks for now; these are the planned CircleCI job
names so branch protection can be remapped in one pass later:

| GHA job `name:` / workflow (not yet ported) | Planned CircleCI job |
|---------------------------------------------|----------------------|
| Fingerprint gate (`fingerprint-gate.yml`) | `fingerprint-gate` (Phase 5) |
| EAS PR update/build (`eas-pr.yml`) | `eas-pr` (Phase 5) |
| EAS dev build (`eas-dev-build.yml`) | `eas-dev-build`, manual pipeline (Phase 5) |
| CD terraform preview/apply (`cd.yml`) | `cd-terraform`, `cd-deploy` (Phase 6) |
| Preview cleanup (`preview-cleanup.yml`) | `preview-cleanup` (Phase 6) |
| Netlify demo / frontend / docs deploys | `deploy-demo`, `deploy-example-frontend`, `deploy-docs` (Phase 4) |
| Publish on tag (`publish-on-tag.yml`) | `publish-npm` (Phase 7, single-writer cutover) |
| Appium / Maestro | `appium-android`, `appium-ios`, `maestro` (Phase 8) |

## Path-filter parity guard

`bun run check:circleci-parity` fails when a GHA `paths:` entry has no mapping to
its CircleCI parameter — otherwise the twin silently never runs. It runs as the
`circleci-parity` job (CircleCI) and the **CircleCI path-filter parity** job
(GitHub Actions `repo-policies`). Add new packages/paths to the mapping in
`.circleci/config.yml` and to `WORKFLOW_PARAMETERS` in
`scripts/check-circleci-parity/check.ts`.

## Config-only changes

`.circleci/config.yml` / `continue-config.yml` edits set `run-circleci-config`,
which runs a representative slice (`api-ci`, `ui-ci`, `example-backend-ci`,
`no-barrel-imports`, `e2e` spec `login`) so config changes are actually exercised
instead of only hitting the always-on smoke jobs.

## Nightly load test

`e2e-load` (syncdb-loadlab) is never PR-blocking. Trigger the **setup** pipeline
with `run-e2e-load`. Setup skips path-filtering and continues with a differently
named continuation parameter (`e2e-load`) so CircleCI does not report conflicting
pipeline parameters.

```json
{"run-e2e-load": true}
```

This replaces the GHA cron / `workflow_dispatch` / `load-test` label triggers in
`e2e-load-nightly.yml`.

## Local validation

```bash
circleci config validate .circleci/config.yml
circleci config validate .circleci/continue-config.yml
```

## Dual-run drift

While both systems run, keep these in sync when editing a GHA workflow:

1. `paths:` → mapping in `.circleci/config.yml` (enforced by `check:circleci-parity`)
2. e2e `spec:` matrix → `e2e` workflow matrix in `continue-config.yml`
3. New package CI workflow → new param + job + `WORKFLOW_PARAMETERS` entry

## Not in this phase

- Netlify / docs / demo / example-frontend **deploys**
- GCP `cd.yml`, preview-cleanup, OIDC
- EAS / fingerprint
- npm publish-on-tag
- Appium / Maestro
- CodeQL, Dependabot auto-merge, triage, gh-aw agentics

Keep matching `.github/workflows/*` until dual-run cutover deletes them per phase.
