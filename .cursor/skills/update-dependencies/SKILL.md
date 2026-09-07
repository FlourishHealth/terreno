---
name: update-dependencies
description: Dependabot-style dependency updates that bump one package (or one catalog pin), prove it with an exercise test, and refuse anything that changes the Expo fingerprint. Trigger with /update-dependencies or phrases like "dependabot", "bump packages", "outdated dependencies", "update npm packages".
---
# Update dependencies

Apply JavaScript and GitHub Actions dependency updates the way Dependabot would,
then prove each bump with a test that actually imports the package. Native Expo
fingerprint changes are **release-only**.

Architecture: [`docs/explanation/dependency-management.md`](../../docs/explanation/dependency-management.md).
Operator steps: [`docs/how-to/update-dependencies.md`](../../docs/how-to/update-dependencies.md).
Fingerprint skip matcher: `scripts/planning/fingerprintRisk.ts`.
Native SDK upgrades: `upgrading-expo` and `release`, never this skill.

## Hard rules

1. **Fingerprint freeze.** Do not bump a package when `isFingerprintSkip(name)` is true. Do not edit `eas.json`, Expo config plugins, `app.json` native fields, or native project files. After every allowed bump, recompute fingerprints for `example-frontend` and `demo`; if either hash changes, revert the bump and stop.
2. **Exercise test.** Do not ship an update unless a test that imports the bumped package ran and passed **after** the bump. Workspace `test:ci` is not enough by itself. If no such test exists, write a tracer-bullet test first, then bump.
3. **One bump per PR.** One npm package, or one root `catalog` pin that that package uses. Do not mix unrelated packages. GitHub Actions pins may group only when they share one Action repo.
4. **7-day cooldown** for non-security npm publishes. Security advisories skip the wait; they still need an exercise test and a fingerprint freeze.
5. **Catalog once.** Shared versions change only in the root `package.json` `catalog`. Workspace manifests keep `"catalog:"`. See `.rulesync/rules/01-dependency-catalog.md`.

## When to use

- Recurring dependency maintenance (Dependabot replacement)
- A human asks to bump, update, or refresh packages
- Dependabot opened a PR that would mix fingerprint-risk packages or lack exercise tests — redo the bump with this skill instead of merging that PR

## When not to use

- Expo SDK, React Native, or native-module upgrades — `upgrading-expo` during a `release`
- Adding a new dependency for a feature — that feature's Pick slice owns it
- `@terreno/*` lockstep upgrades — `upgrading-terreno`

## Procedure

### 1. Inventory

Start from latest `master` with a clean tree. Record a fingerprint **baseline** before any install:

```bash
git checkout master && git pull origin master
git status --short   # must be empty
bun outdated
```

Fingerprint hashes (both apps, iOS and Android). Prefer `eas fingerprint:generate --platform <ios|android> --non-interactive --json` when `EXPO_TOKEN` is set; otherwise `bunx @expo/fingerprint <app-dir>`. Save the four hashes. Completion: baseline file or note contains iOS+Android hashes for `example-frontend` and `demo`.

Cooldown: `npm view <name> time --json` → `time[<version>]` must be at least 7 days old unless the bump is a published security advisory.

Drop every name where `isFingerprintSkip(name)` is true. List those as **deferred to release**. Do not install them. Categories: [`references/fingerprint-risk.md`](references/fingerprint-risk.md).

Completion: a candidate list with name, current version, target version, catalog vs workspace, security vs cooldown, and skip/candidate.

### 2. Exercise coverage

How to find or write the test: [`references/exercise.md`](references/exercise.md).

For **each** candidate, search the repo for imports of that package. Find a `*.test.ts` / `*.test.tsx` / `*.spec.ts` that imports it.

- If one exists, name that file. That is the exercise test.
- If none exists, write a tracer-bullet test in the package that depends on it: import the real module (no mock of the dependency) and assert one behavior this repo relies on. Run it **before** the bump so the test is red-or-green against the current version.

Completion: every candidate has a named exercise test file that imports the package.

### 3. Apply one bump

1. If the package is in the root `catalog`, change only that catalog pin. If it is single-use, change only that workspace `package.json`.
2. `bun install` from the repo root.
3. Run the named exercise test. Then lint/compile the consuming package(s).
4. Recompute all four fingerprint hashes.

If the exercise test fails: revert, record the failure, continue to the next candidate. Do not expand the bump to "fix" native peers with `expo install --fix`.

If any fingerprint hash differs from baseline: revert the bump and lockfile, add the package to the deferred-to-release list, even if `isFingerprintSkip` was false.

Completion: working tree contains exactly one intended bump, fingerprints match baseline, exercise test passed on the new version.

### 4. PR

One branch, one package. Title: `chore(deps): bump <name> from <old> to <new>`.

PR body must include:

| Field | Value |
| --- | --- |
| Package | name, old → new |
| Catalog | yes / no |
| Exercise test | path + command that passed |
| Fingerprint | example-frontend and demo iOS/Android unchanged vs baseline |
| Cooldown | publish age or CVE id |

Do not enable auto-merge for major version bumps. Dependabot auto-merge must not be used as a substitute for this table.

Completion: draft PR open with the table filled from commands that actually ran.

### 5. Repeat

Return to a clean `master` (or a fresh branch from `master`) before the next candidate. Do not stack unrelated bumps on one branch.

## Deferred native bumps

Hand the skip list to `release` / `upgrading-expo`. Do not file a fingerprint-changing dependency PR from this skill.
