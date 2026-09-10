# Static analysis

Run `bun run analyze:full` before pushing changes that alter imports, exports, package
dependencies, or module boundaries.

Terreno uses two analysis speeds so agents receive quick edit feedback without replacing
repository-wide correctness checks with a partial changed-file scan.

## Analysis layers

| Layer | Command | Scope | Enforcement |
| --- | --- | --- | --- |
| Biome | `bun run analyze:fast` | Changed and untracked analyzable files | Agent post-edit hooks |
| Biome | `bun run analyze:staged` | Staged analyzable files | Git pre-commit |
| Knip | `bun run analyze:full` | Both development and production module graphs | Agent stop hooks and CI |
| dependency-cruiser | `bun run analyze:full` | Workspace source dependency graph | Agent stop hooks and CI |

Biome runs from the nearest workspace configuration. Knip finds unused files, exports,
types, dependencies, binaries, and duplicate exports. dependency-cruiser rejects new
cycles and production imports from test or isolated modules while reporting orphan
modules.

Knip ignores `**/dist/**` so analysis reports the same findings whether or not the
workspace has been compiled. CI analyzes a fresh checkout and never builds, while local
development runs `bun run bootstrap`; without that exclusion, each package's compiled
`dist/*.d.ts` entry point contributes unlisted-dependency findings that CI can never
reproduce.

## Entry graph

Knip only follows files reachable from entries. Register executed-but-unimported files
in `knip.jsonc` `workspaces.<name>.entry` instead of deleting them or stuffing them into
the JSON baseline.

Setting `entry` **replaces** Knip’s default `{index,cli,main}` / `src/{index,cli,main}`
patterns for that workspace, so those defaults must be repeated next to extra globs.

| Kind | Why Knip misses it | Entry |
| --- | --- | --- |
| `*.isolated.ts(x)` | Run as `bun test $file`, not `*.test.ts` | `src/isolated/**/*.isolated.{ts,tsx}` on the owning package |
| `scripts/**/*.test.ts`, `.github/scripts/**/*.test.ts` | Root `test` is `bun run --filter '*' test:ci`, so the Bun plugin never loads them | Root workspace `"."` |
| OpenAPI codegen configs, Metro `jspdf` stubs, Expo fingerprint configs, Playwright CI config, `ui/babel.config.js`, Docusaurus `src/theme/**` swizzles, `scripts/ci/prepare-package-publish.mjs` | Invoked by Expo/Metro/Docusaurus/CI, not imported from app `index` | Extra `entry` globs on the owning workspace |
| Generated `expo-cicd-workflows/scripts/*.js` (including `.rulesync/`) | Skill copies; they import `ajv` / `js-yaml` outside this repo’s package graph | `ignore` globs |
| `example-backend` production dependencies | Knip's package-script entry for `bun run src/index.ts` shadows the explicit `src/index.ts!` entry in production mode | Keep default-mode enforcement; use exact dependency names suffixed with `!` as production-only exceptions |

## Runtime-only dependencies

Do not remove an Expo, React Native, or Metro dependency solely because Knip cannot find
a static import. Expo autolinking, `app.json` plugin strings, Metro aliases/polyfills,
platform-specific modules, and published UI peer surfaces load dependencies outside
Knip's source graph. Keep those dependencies in the owning `package.json` and list them
under that workspace's `ignoreDependencies` in `knip.jsonc`, with a comment naming the
runtime loader.

The same rule covers externally installed CLIs (`maestro`, `eas`), catalog pins retained
for native fingerprint compatibility, and optional peers consumed by published-package
users. Declare those narrowly with `ignoreBinaries` or `ignoreDependencies`; do not add a
fake local import.

## Ratchets

The repository already contains findings that cannot be removed in one change. The
checked-in baselines allow existing findings to remain while rejecting new ones:

- `scripts/static-analysis/knip-baseline.json`
- `.dependency-cruiser-known-violations.json`

Knip fingerprints omit line and column positions, so moving an existing declaration does
not create a false regression. A renamed symbol, moved file, or new finding must be fixed
or deliberately reviewed into the baseline.

After intentionally accepting repository-wide analysis changes, regenerate both
baselines:

```bash
bun run analyze:baseline
bun run analyze:full
```

Review the baseline diff before committing it. Never run `knip --fix` unattended because
an incomplete entry graph can remove runtime-loaded code.

## Agent hooks

`.rulesync/hooks.json` is the hook source of truth. `bun run rules` translates it into
native configuration for Cursor, Claude Code, Codex CLI, GitHub Copilot, Copilot CLI,
Google Antigravity CLI, and Devin.

Post-edit events run the changed-file Biome command. Stop events run both repository-wide
ratchets. Hook failure and retry behavior differs by host, so CircleCI remains the merge
gate and the real Git pre-commit hook covers commits made outside an agent.

`simple-git-hooks` installs the pre-commit hook during `bun install` through the root
`prepare` script.

## Configuration ownership

| File | Purpose |
| --- | --- |
| `knip.jsonc` | Entry graph, plugins, generated-code exceptions |
| `.dependency-cruiser.js` | Dependency rules and resolver conditions |
| `.rulesync/hooks.json` | Canonical agent lifecycle hooks |
| `scripts/static-analysis/` | Portable hook commands, ratchet logic, and tests |

Generated agent hook files must not be edited directly. Change `.rulesync/hooks.json`,
then run `bun run rules`.
