# GitHub Actions CI (Terreno)

GitHub Actions is the CI of record. Operator map for the expensive jobs:
[GitHub Actions CI](github-actions-ci.md). CircleCI twins are parked; see
[CircleCI](circleci.md).

## Docs site (`docs-deploy.yml`)

`Build docs site` is often the longest PR job because Docusaurus compiles every
versioned tree under `website/versioned_docs/` and TypeDoc regenerates API
pages.

PR builds set `DOCS_PREVIEW=true` and pass `--no-minify`. Both PR and
`master` use Docusaurus Faster (Rspack/SWC via `@docusaurus/faster`).

| Behavior | PR preview | `master` production |
| --- | --- | --- |
| Versioned docs (`57.1.0`, `0.30.0`, …) | Omitted (`disableVersioning`) | Built |
| JS minify | Off | On |
| Local search index | Skipped | Built |
| Generated API + component MDX | Restored from cache when `api`/`rtk`/`ui` hashes match | Same cache, then full generate on miss |
| TypeDoc workspace `tsc` | Once per generate (api+rtk deps share a process) | Same |
| Rspack cache (`node_modules/.cache/rspack`) | Restored per `pull_request` vs `push` | Separate production key |

Production still builds every version. Do not rely on `/57.1.0/…` URLs in a
PR deploy preview.

## Other high-cost jobs

| Workflow | What we skip or reuse |
| --- | --- |
| `e2e-ci`, `admin-spa-ci`, `admin-spa-integration` | Playwright Chromium under `~/.cache/ms-playwright`, keyed on `bun.lock`. E2E shards share one compile job (`workspace-dist` artifact) so required check names stay `E2E · <spec>`. |
| `fingerprint-gate` | Master iOS/Android hashes cached per `pull_request.base.sha` (skips a second `bun run compile`) |
| `maestro-e2e` | Demo export + static server only when `demo/`, `ui/`, or `.maestro/flows/demo/` change |
| `example-backend-docker` | Buildx runs only when the image recipe changes (`Dockerfile`, lockfile, `package.json`). Source-only PRs skip; CD preview deploy still builds the image. `load: true` stays off. |
| `cd` backend preview | Runs the built container against the configured Secret Manager values and requires a healthy `/health` response before pushing or deploying. Failed Cloud Run deploys print revision conditions and logs when IAM allows. |
| Bun install | `.github/actions/setup-bun-workspace` pins Bun `1.4.0` and caches `~/.bun/install/cache` without `github.ref` in the key |

Playwright e2e still uses one shard per spec file so required check names stay
`E2E · <spec>`.
