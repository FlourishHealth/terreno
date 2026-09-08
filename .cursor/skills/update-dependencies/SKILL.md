---
name: update-dependencies
description: 'Daily Dependabot-style updates on one rolling PR: bump proven packages, exercise each with a test that imports it, refuse Expo fingerprint changes, and reuse the existing PR (ledger of what worked and failed). Trigger with /update-dependencies or phrases like "dependabot", "daily dependency updates", "bump packages", "outdated dependencies".'
---
# Update dependencies

Daily JavaScript and GitHub Actions updates. Prove each bump with a test that
imports the package. Native Expo fingerprint changes are **release-only**.
Keep **one** open PR and rewrite it every day — never open a second.

Architecture: [`docs/explanation/dependency-management.md`](../../docs/explanation/dependency-management.md).
Operator steps: [`docs/how-to/update-dependencies.md`](../../docs/how-to/update-dependencies.md).
Fingerprint skip matcher: `scripts/planning/fingerprintRisk.ts`.
Rolling PR + ledger: [`references/rolling-pr.md`](references/rolling-pr.md) (`scripts/planning/updateDependenciesPr.ts`).
Native SDK upgrades: `upgrading-expo` and `release`, never this skill.

## Hard rules

1. **Fingerprint freeze.** Do not bump a package when `isFingerprintSkip(name)` is true. Do not edit `eas.json`, Expo config plugins, `app.json` native fields, or native project files. After every allowed bump, recompute fingerprints for `example-frontend` and `demo`; if either hash changes, revert **that bump** (keep earlier proven bumps) and log it as failed.
2. **Exercise test.** Do not keep an update unless a test that imports the bumped package ran and passed **after** the bump. Workspace `test:ci` is not enough by itself. If no such test exists, write a tracer-bullet test first, then bump.
3. **One trusted rolling PR.** Reuse only a same-repository PR whose head is exactly `chore/update-dependencies`, base is `master`, and `isTrustedRollingPr` passes. Marker/title matches never establish trust. Ignore fork candidates; never checkout, copy, edit, close, or comment on them. Do not create a second trusted dependency PR.
4. **Ledger.** Every run appends what landed, failed, skipped, and deferred. Prior failure rows stay until that package lands or a human drops them. Details: [`references/rolling-pr.md`](references/rolling-pr.md).
5. **7-day cooldown** for non-security npm publishes. Security advisories skip the wait; they still need an exercise test and a fingerprint freeze.
6. **Catalog once.** Shared versions change only in the root `package.json` `catalog`. Workspace manifests keep `"catalog:"`. See `.rulesync/rules/01-dependency-catalog.md`.

## When to use

- The daily maintenance cron / scheduled agent
- A human asks to bump, update, or refresh packages
- Dependabot opened extra PRs — fold proven JS bumps into the rolling PR; do not merge fingerprint-risk Dependabot PRs

## When not to use

- Expo SDK, React Native, or native-module upgrades — `upgrading-expo` during a `release`
- Adding a new dependency for a feature — that feature's Pick slice owns it
- `@terreno/*` lockstep upgrades — `upgrading-terreno`

## Procedure

### 1. Attach the rolling PR

Follow [`references/rolling-pr.md`](references/rolling-pr.md): find the trusted same-repository PR, merge `origin/master` into `chore/update-dependencies` without rewriting history, and restore the ledger from the trusted PR body.

Completion: at most one trusted open PR identified (or none, to create after the first write); forks/spoofs are ignored; branch contains current master; yesterday's Landed/Failed/Skipped tables are in hand.

### 2. Inventory

From that branch (after rebase), record a fingerprint **baseline** before any new install:

```bash
bun outdated
```

Fingerprint hashes (both apps, iOS and Android). Prefer `eas fingerprint:generate --platform <ios|android> --non-interactive --json` when `EXPO_TOKEN` is set; otherwise `bunx @expo/fingerprint <app-dir>`. Save the four hashes. Completion: baseline contains iOS+Android hashes for `example-frontend` and `demo`.

Cooldown: `npm view <name> time --json` → `time[<version>]` must be at least 7 days old unless the bump is a published security advisory.

Drop every name where `isFingerprintSkip(name)` is true into **Deferred to release**. Do not install them. Categories: [`references/fingerprint-risk.md`](references/fingerprint-risk.md).

Retry **Failed** rows from the ledger before new `bun outdated` names.

Completion: a candidate list with name, current version, target version, catalog vs workspace, security vs cooldown, skip/candidate, and whether it is a ledger retry.

### 3. Exercise coverage

How to find or write the test: [`references/exercise.md`](references/exercise.md).

For **each** candidate, search the repo for imports of that package. Find a `*.test.ts` / `*.test.tsx` / `*.spec.ts` that imports it.

- If one exists, name that file. That is the exercise test.
- If none exists, write a tracer-bullet test in the package that depends on it: import the real module (no mock of the dependency) and assert one behavior this repo relies on. Run it **before** the bump so the test is red-or-green against the current version.

Completion: every candidate attempted this run has a named exercise test file that imports the package.

### 4. Apply bumps on the rolling branch

For each candidate, one at a time on `chore/update-dependencies`:

1. If the package is in the root `catalog`, change only that catalog pin. If it is single-use, change only that workspace `package.json`.
2. `bun install` from the repo root.
3. Run the named exercise test. Then lint/compile the consuming package(s).
4. Recompute all four fingerprint hashes against this run's baseline.

If the exercise test fails: revert that bump and lockfile, add/update a **Failed** row, continue to the next candidate. Do not expand the bump with `expo install --fix`.

If any fingerprint hash differs from baseline: revert that bump and lockfile, log **Failed** (fingerprint), even if `isFingerprintSkip` was false. Baseline stays the hashes from the start of this run (proven bumps already on the branch are included). After a successful bump, **refresh the baseline** to the new hashes so the next bump is compared to the stacked tree.

Commit each successful bump on the rolling branch (`chore(deps): bump <name> from <old> to <new>`).

Completion: every candidate this run is in Landed, Failed, Skipped, or Deferred; fingerprints of the branch match the last successful baseline; no second PR exists.

### 5. Push and update the same PR

Push `chore/update-dependencies`. If a trusted open PR exists, update its body ledger (do not open another). If none exists, create one from the canonical branch in the base repository with the marker and skeleton in [`references/rolling-pr.md`](references/rolling-pr.md).

Majors that landed stay on the rolling PR; say so in Last run. Do not enable auto-merge for a run that includes a major.

Completion: the single open PR body lists this UTC date, every landed bump with its exercise command, every failure with cause, and deferred fingerprint names.

## Deferred native bumps

Keep them on the **Deferred to release** table. Hand that list to `release` / `upgrading-expo`. Do not put fingerprint-changing bumps on this branch.
