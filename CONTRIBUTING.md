# Contributing to Terreno

Thank you for helping make Terreno better. This guide covers how to set up the
repo, run checks, and open a pull request.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Ways to contribute

- **Report a bug** — open a [bug report](.github/ISSUE_TEMPLATE/bug_report.yml) issue
- **Suggest a feature** — open a [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) issue or start a GitHub Discussion
- **Fix documentation** — open a [docs issue](.github/ISSUE_TEMPLATE/docs_issue.yml) or send a PR with doc edits
- **Submit code** — fork, branch, test, and open a draft PR (see below)

## Development setup

### Prerequisites

- [Bun](https://bun.sh/) — use the latest stable release (CI runs `bun-version: latest`)
- **MongoDB replica set** — required to run `example-backend` locally (change streams power realtime and feature-flag sync). A single-node replica set is enough for development.

### Bootstrap

From the repository root:

```bash
bun run bootstrap
```

This runs `bun install` and compiles all workspace packages.

### Example full stack

Terminal 1 — backend (needs MongoDB + auth secrets):

```bash
MONGO_URI="mongodb://127.0.0.1:27017/terreno-example?replicaSet=rs0" \
  TOKEN_SECRET=dev-token-secret TOKEN_ISSUER=terreno-dev \
  REFRESH_TOKEN_SECRET=dev-refresh-secret SESSION_SECRET=dev-session-secret \
  PORT=4000 bun run backend:dev
```

Terminal 2 — frontend:

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000 bun run frontend:web
```

Seed test users (same env vars as the backend):

```bash
bun run backend:seed
```

Seeded accounts (from `example-backend/src/scripts/seed-test-data.ts`):

| Email | Password | Notes |
| ----- | -------- | ----- |
| `test@example.com` | `testpassword123` | Regular user |
| `admin@example.com` | `testpassword123` | Admin user |

Health check: `curl localhost:4000/health` should return `"healthy": true`.

See [AGENTS.md](AGENTS.md) for Cloud VM MongoDB setup details.

## Common commands

Run these from the repository root:

| Command | Purpose |
| ------- | ------- |
| `bun run compile` | Compile all packages |
| `bun run lint` | Lint all packages |
| `bun run lint:fix` | Auto-fix lint issues where possible |
| `bun run api:test` | Run `@terreno/api` tests |
| `bun run ui:test` | Run `@terreno/ui` tests |
| `bun run test` | Run all package test suites |
| `bun run check:no-barrel-imports` | Enforce no internal barrel imports |
| `bun run check:licenses` | Verify published packages ship a LICENSE |
| `bun run backend:dev` | Start example backend |
| `bun run frontend:web` | Start example frontend (web) |
| `bun run demo:start` | Start UI component demo |

Package-specific commands are listed in [AGENTS.md](AGENTS.md).

## Code style

Follow the conventions in [AGENTS.md](AGENTS.md). Highlights:

- **No barrel imports** — import concrete module files, not directory `index` re-exports. See [docs/explanation/no-barrel-imports.md](docs/explanation/no-barrel-imports.md). Enforced by Biome and `bun run check:no-barrel-imports`.
- **Dates** — use [Luxon](https://moment.github.io/luxon/), not `Date` or dayjs.
- **Logging** — backend: `logger.info/warn/error/debug` from `@terreno/api`; frontend: `console.info/debug/warn/error` for permanent logs. Do not leave `console.log` in committed code.
- **TypeScript** — prefer interfaces over types; const arrow functions; explicit return types.

## Tests

- New features and bug fixes should include tests. Coverage must not drop across a PR.
- Backend: `bun test` with `expect` (see package `test` scripts).
- Run the relevant package tests before opening a PR (`bun run api:test`, `bun run ui:test`, etc.).

## How work gets planned

1. **Ideas** — start in [GitHub Discussions → Ideas](https://github.com/FlourishHealth/terreno/discussions/new?category=ideas); do not open a tracking issue yourself.
2. **Promotion** — a maintainer promotes an accepted idea to a `Shaping` tracking issue on the [Terreno Roadmap](https://github.com/FlourishHealth/terreno/blob/master/ROADMAP.md) board (`roadmap-promote`).
3. **Design** — substantial work gets an [implementation plan](docs/implementationPlans/README.md) (IP) plus a task list before large coding begins. When the IP is approved, the tracking issue moves to `Planned` and gets its `IP` field set (`roadmap-item` — it updates the promoted issue, it does not open a second one).
4. **Build** — the [`terreno-planning` plugin](plugins/README.md) takes it from there: Blend (plan) → Roast (implement) → Cupping (verify) → Pour (open PR) → Dial In (review loop).
5. **RFC path** — API or package changes that affect consumers start in [RFCs](https://github.com/FlourishHealth/terreno/discussions/new?category=rfcs); accepted RFCs become IPs.

See the [roadmap process](docs/explanation/roadmap-process.md) for the full IP ↔ roadmap lifecycle, the promote-vs-item split, maintainer setup, and the Linear bridge.

## When to write an implementation plan (IP)

Substantial work should be planned before coding:

| Needs an IP | Does not need an IP |
| ----------- | ------------------- |
| New published package | Bug fix in one package |
| New public API surface | Documentation-only change |
| Cross-package architectural change | Small internal refactor |
| Breaking change | Test or CI fix |

Process:

1. Read [docs/implementationPlans/README.md](docs/implementationPlans/README.md)
2. Copy [docs/implementationPlans/IP_TEMPLATE.md](docs/implementationPlans/IP_TEMPLATE.md) into `docs/implementationPlans/<slug>.md`
3. Add a companion task list in `docs/tasks/<slug>.md`
4. Get the IP reviewed before large implementation begins

## Developer Certificate of Origin (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/) (DCO). Every commit in a pull request from an external fork must include a `Signed-off-by` line that matches the commit author.

Sign off when you commit:

```bash
git commit -s -m "fix(api): handle empty query filter"
```

This appends a line like `Signed-off-by: Your Name <you@example.com>` to the commit message. CI enforces DCO on external PRs (see `.github/workflows/dco.yml`).

## Pull requests

1. **Branch** — create a feature branch from `master`
2. **Draft PR** — open as a draft until CI is green and you are ready for review
3. **CI** — `bun run lint`, relevant tests, and repo policy checks must pass
4. **UI changes** — if you touch frontend packages (`ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, or frontend-integrated `rtk/`), include screenshots or a screen recording in the PR body showing the change
5. **Description** — explain what changed and why; link related issues or IPs

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md). Do not file public issues for security problems.

## Maintainer repository settings

GitHub settings that cannot be committed (Discussions categories, branch
protection, vulnerability reporting) are documented in
[docs/explanation/repository-settings.md](docs/explanation/repository-settings.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE) that covers the project.
