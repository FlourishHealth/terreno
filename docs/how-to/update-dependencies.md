# Update dependencies

This runs **daily**. Use `/update-dependencies`. There is one rolling PR; later days push to it and rewrite its ledger instead of opening new PRs.

```bash
gh pr list --state open --search "terreno-update-dependencies in:body" \
  --json number,url,headRefName
bun outdated
```

Prove each bump with an **exercise test** that imports that package. Keep Expo fingerprints for `example-frontend` and `demo` unchanged. Skip `isFingerprintSkip` names until a release.

Why: [Dependency management](../explanation/dependency-management.md). Native Expo/React Native bumps wait for `upgrading-expo`.

## Do now

1. Find the open PR whose body contains `<!-- terreno-update-dependencies -->`. Checkout `chore/update-dependencies` and rebase onto `origin/master`. If none exists, that branch is created on this run.
2. Inventory with `bun outdated`. Retry **Failed** rows from the PR body first. Skip `isFingerprintSkip` in `scripts/planning/fingerprintRisk.ts`.
3. For each candidate: confirm a test imports the package (add a tracer if needed), bump the catalog pin or single-use version, `bun install`, re-run that test, recompute fingerprints. Revert only that bump on failure.
4. Commit each success on the same branch. Push. Update the **same** PR body: Last run, Landed, Failed, Skipped, Deferred to release. Do not `gh pr create` when that PR is already open.
5. Read the ledger tomorrow; do not start a new PR.

## Guardrails

| Rule | Action |
| --- | --- |
| Open rolling PR already exists | Push to `chore/update-dependencies` and edit that body |
| Fingerprint would change | Revert that bump. Defer to a release. Never add `fingerprint-acknowledged` |
| No test imports the package | Write the tracer test first. Do not bump on `test:ci` alone |
| Published < 7 days ago (non-CVE) | Skip; log under Skipped |
| Major version | May land on the rolling PR if tests + fingerprints pass; no auto-merge |
| Dependabot extra PRs | Do not merge skip-list packages; fold JS bumps into the rolling PR |

## Fingerprints

`example-frontend` and `demo` use `fingerprint.config.js`. Hash with `eas fingerprint:generate` when `EXPO_TOKEN` is set, otherwise `bunx @expo/fingerprint <app-dir>`. Take a baseline after rebase, before new installs. After each successful bump, the new hashes become the baseline for the next package.

`eas.json` Bun pins feed the fingerprint. Do not bump them here.

## Dependabot still runs

GitHub Dependabot remains in `.github/dependabot.yml`. Root catalog ignores native/Expo packages. Treat Dependabot as a signal; land updates on the rolling PR from this guide.
