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
| Admin SPA Backend Integration E2E | `admin-spa-integration` |
| _(smoke)_ | `config-ok` |

## Local validation

```bash
circleci config validate .circleci/config.yml
circleci config validate .circleci/continue-config.yml
```

## Not in this phase

- Netlify / docs / demo / example-frontend **deploys**
- GCP `cd.yml`, preview-cleanup, OIDC
- EAS / fingerprint
- npm publish-on-tag
- Appium / Maestro
- CodeQL, Dependabot auto-merge, triage, gh-aw agentics

Keep matching `.github/workflows/*` until dual-run cutover deletes them per phase.
