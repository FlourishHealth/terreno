# Update dependencies

This runs **daily**. Use `/update-dependencies`. There is one rolling PR; later days push to it and rewrite its ledger instead of opening new PRs.

```bash
REPOSITORY="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
OWNER="${REPOSITORY%%/*}"
NAME="${REPOSITORY#*/}"
gh pr list --state open --head chore/update-dependencies \
  --json number,url,baseRefName,headRefName,headRepository,headRepositoryOwner,isCrossRepository \
  | jq --arg owner "$OWNER" --arg name "$NAME" \
      '[.[] | select(
        .isCrossRepository == false and
        .baseRefName == "master" and
        .headRefName == "chore/update-dependencies" and
        .headRepository.name == $name and
        .headRepositoryOwner.login == $owner
      )]'
bun outdated
```

Prove each bump with an **exercise test** that imports that package. Keep Expo fingerprints for `example-frontend` and `demo` unchanged. Skip `isFingerprintSkip` names until a release.

Why: [Dependency management](../explanation/dependency-management.md). Native Expo/React Native bumps wait for `upgrading-expo`.

## Do now

1. Find the same-repository PR with exact head `chore/update-dependencies`, base `master`, and `isCrossRepository: false`. Marker/title matches are not trust signals; ignore forks. Merge `origin/master` without rewriting history. If no trusted PR exists, create the canonical branch on this run.
2. Inventory with `bun outdated`. Retry **Failed** rows from the PR body first. Skip `isFingerprintSkip` in `scripts/planning/fingerprintRisk.ts`.
3. For each candidate: confirm a test imports the package (add a tracer if needed), bump the catalog pin or single-use version, `bun install`, re-run that test, recompute fingerprints. Revert only that bump on failure.
4. Commit each success on the same branch. Push. Update the **same** PR body: Last run, Landed, Failed, Skipped, Deferred to release. Do not `gh pr create` when that PR is already open.
5. Read the ledger tomorrow; do not start a new PR.

## Guardrails

| Rule | Action |
| --- | --- |
| Trusted rolling PR already exists | Push to its same-repository `chore/update-dependencies` head and edit that body |
| Fork copies marker/title/branch | Ignore it; never checkout, copy, edit, close, or comment on it |
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
