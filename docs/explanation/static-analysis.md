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
