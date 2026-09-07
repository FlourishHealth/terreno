# Rolling daily PR

This skill runs **daily**. There is at most one open dependency-update PR.

Constants (do not invent a second name): `scripts/planning/updateDependenciesPr.ts`

| Constant | Value |
| --- | --- |
| Branch | `chore/update-dependencies` |
| Title | `chore(deps): daily dependency updates` |
| Body marker | `<!-- terreno-update-dependencies -->` |

## Find or attach

```bash
gh pr list --state open --search "terreno-update-dependencies in:body" \
  --json number,url,headRefName,title,body
```

- **One open PR with that marker:** that is the PR. Checkout `chore/update-dependencies` (or the PR head if they differ — then reset the canonical branch name on the next push). Do not open another PR.
- **Open PR, no marker, title matches or head is `chore/update-dependencies`:** reuse it. Insert the marker into the body on this run.
- **Several open PRs:** keep the oldest numbered one. Comment on the others that they are duplicates, close them without merging, cherry-pick any proven commits onto the canonical branch.
- **No open PR:** create **one** from `chore/update-dependencies` after the first proven bump (or after recording a run with only skips/failures so the ledger exists).

Never `gh pr create` when an open marked PR already exists. Push to the existing head and edit the body.

## Rebase each run

```bash
git fetch origin master
git checkout chore/update-dependencies 2>/dev/null \
  || git checkout -b chore/update-dependencies origin/master
git rebase origin/master
```

If rebase conflicts: abort, recreate the branch from `origin/master`, and replay only commits that are still proven (re-run exercise tests). Do not force-push unless this branch has no reviewers' unique commits; this branch is agent-owned.

## Ledger

The PR body is the memory across days. Preserve prior rows. Update in place.

Required sections after the marker:

1. **Last run** — ISO date (UTC), agent/run id if known, `bun outdated` summary count
2. **Landed** — package, old → new, exercise test path + command, fingerprint unchanged
3. **Failed** — package, attempted version, date, cause (test path + error snippet, fingerprint hash change, install failure). Keep the row until a later run lands it or a human drops it.
4. **Skipped** — fingerprint-skip, cooldown (<7 days), already at target
5. **Deferred to release** — `isFingerprintSkip` names seen this run

Move a package from **Failed** to **Landed** when a later day succeeds. Append a one-line **Run log** under Last run (`2026-09-08: landed luxon; failed mongoose (exercise); skipped expo`).

Do not delete failure history when the PR is still open. After merge, the next day starts a new PR; do not scrape closed PRs unless retrying a named failure.

## Body skeleton

```markdown
<!-- terreno-update-dependencies -->

## Last run

- Date: 2026-09-08
- Landed 1, failed 1, skipped 4 (2 fingerprint, 2 cooldown)

### Run log
- 2026-09-07: opened; landed axios; failed chai (exercise `api/src/foo.test.ts`)
- 2026-09-08: rebased master; landed chai; skipped expo-*

## Landed
| Package | From → to | Exercise | Fingerprint |
| --- | --- | --- | --- |
| axios | 1.13.1 → 1.13.2 | `bun test api/src/http.test.ts` | example-frontend + demo unchanged |

## Failed
| Package | Attempted | Date | Cause |
| --- | --- | --- | --- |
| mongoose | 9.8.0 | 2026-09-07 | exercise `api/src/models.test.ts` — timeout |

## Skipped
| Package | Reason |
| --- | --- |
| left-pad@1.9.0 | published 2 days ago |

## Deferred to release
`expo`, `expo-router`, `react-native-reanimated`
```
