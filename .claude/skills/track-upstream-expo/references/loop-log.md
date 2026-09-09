# Loop log contract

Path: `scripts/track-upstream-expo/loop-log.md` (same path on every `release-*`
branch). Tracker machine state: `scripts/track-upstream-expo/tracked.json`
(`loopStatus`).

`loopStatus` values:

| Value | Probe |
| --- | --- |
| `idle` | Exit 1 unless a newer SDK major exists |
| `open` | Exit 0 `resume-loop` even on the same beta |
| `blocked` | Same as `open` — re-read the log, do not blindly retry `Do not retry` |
| `ready` | Exit 1 unless a newer preview/stable exists (`continue-branch`) |

## Required headings (keep these names)

```markdown
# Expo SDK loop log

## Status
- sdkLine:
- expoVersion:
- releaseBranch:
- loopStatus:
- updatedAt:

## Next
One bounded action for tomorrow. Not a recap.

## Open
Unchecked work. Empty means either `ready` or `idle`.

## Tried (newest first)
Every attempt, including failures. Newest at the top.

## Do not retry
Failed approaches plus the error line. Do not repeat without new evidence
(new Expo preview, new upstream fix, or a different package version).

## Worked
Fixes that landed. Enough detail to keep.

## Release notes draft
Running notes for the SDK train: Breaking / Native fingerprint / Expo API /
Other. This is not `CHANGELOG.md` yet.
```

## Tried entry shape

```markdown
### <ISO date> — <expoVersion>
- Action: what you ran or edited
- Result: worked | failed | skipped
- Evidence: command + first error line, or test name
- Follow-up: none | see Open
```

## Write rules

1. Read the whole file before any install or code edit.
2. Append a **Tried** entry as soon as an attempt finishes — do not wait for
   a green compile.
3. Move a failed approach into **Do not retry** the same commit.
4. Rewrite **Next** every session (one action).
5. Commit `loop-log.md` and `tracked.json` together on the release branch
   even when the rest of the branch is still red.
6. Never delete history from **Tried** or **Do not retry**. Strike through
   a Do-not-retry item only if a later Expo preview invalidates it, and say
   which preview.
