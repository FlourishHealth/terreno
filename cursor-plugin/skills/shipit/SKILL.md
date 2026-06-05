---
name: shipit
description: >-
  Full PR pipeline — pre-commit checks, commit, push, create/update PR, wait for CI,
  poll for bot reviews, auto-respond and fix review feedback, resolve addressed threads,
  and loop until mergeable or blocked. Use /shipit when feature work is ready to ship.
---

# Ship It

End-to-end pipeline from local changes to a mergeable PR. Combines pre-commit validation,
commit/push/PR setup, CI monitoring, and automatic bot review handling.

## When to Use

- Feature work is complete and ready to submit
- You want one command to handle the full ship cycle
- After `/buildit` or manual implementation is done

## Do Not Use When

- Only committing without PR/CI work → use `/commit`
- Only creating a PR without checks → use `/create-pr`
- Only fixing review comments on an existing PR → use `/respond-to-review`
- Only monitoring CI → use `/check-watcher`

## Pipeline Overview

```
Pre-commit → Commit → Push → PR → CI (check-watcher) → Bot reviews → Fix loop → Done
```

## Phase 1: Pre-Commit

Run pre-commit checks (adapt to changed packages):

```bash
# From repo root — scope to touched packages when possible
bun run lint
bun run compile
bun run api:test    # if api/ changed
bun run ui:test     # if ui/ changed
```

| Changed area | Required checks |
|---|---|
| `api/` | lint, compile, `api:test` |
| `ui/` | lint, compile, `ui:test` |
| `example-backend/` | lint, compile, backend tests |
| `example-frontend/` | lint, compile, frontend tests |
| Other packages | lint, compile for that package |

**Stop on failure.** Fix issues before committing.

## Phase 2: Commit and Push

1. Review `git status` and `git diff`
2. Stage relevant files (not unrelated changes)
3. Commit with a clear message describing **why**, not just what
4. Push: `git push -u origin <branch-name>`

If push fails due to network errors, retry up to 4 times with exponential backoff (4s, 8s, 16s, 32s).

## Phase 3: Pull Request

1. Check for an existing PR on the current branch
2. If none exists, create a draft PR (read PR template if present)
3. If one exists, update description if the change set materially changed

Use branch naming: `cursor/<descriptive-name>-dcb3` for cloud agent branches.

## Phase 4: Wait for CI

Run `/check-watcher` **in the foreground** — do not background it.

- Poll GitHub Actions until all required checks pass or one fails
- On failure: diagnose, fix, commit, push, and re-run check-watcher
- Repeat until CI is green

Required checks typically include: lint, compile, api tests, ui tests (as applicable).

## Phase 5: Bot Review Loop

After CI passes, enter the bot review loop. This merges `/autobot` and `/respond-to-review` behavior.

### 5a. Poll for bot reviews

```bash
gh pr view --json reviews,comments,statusCheckRollup
gh api repos/{owner}/{repo}/pulls/{number}/comments
```

Bot identities to watch: `cursor[bot]`, `bugbot`, `github-actions[bot]`, and other automated reviewers configured on the repo.

Wait up to **10 minutes** for the first bot review. Poll every **30 seconds**.

### 5b. Triage feedback

| Situation | Action |
|---|---|
| Bot review with actionable code comments | Auto-fix (5c) |
| Bot review says "no issues" / approved | Resolve threads (5d), proceed to done |
| No bot review after 10 min | Proceed to done — do not block on silence |
| CI failed during loop | Fix CI first, then resume from Phase 4 |

### 5c. Auto-fix review comments

For each actionable bot comment:

1. Read the full comment and diff context
2. Implement the fix in code — do not reply "will fix" without changing code
3. Run targeted lint/test for the changed area
4. Commit and push: `fix: address bot review — <brief description>`
5. Re-run check-watcher until CI is green again

Use the same fix patterns as `/respond-to-review` (read that skill for GitHub GraphQL thread resolution and reply templates).

### 5d. Resolve addressed threads

After pushing fixes, resolve review threads that are fully addressed:

```bash
# List unresolved threads
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes { id isResolved comments(last: 1) { nodes { body author { login } } } }
        }
      }
    }
  }' -f owner=OWNER -f repo=REPO -F number=NUMBER

# Resolve a thread
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } }
  }' -f threadId=THREAD_ID
```

### 5e. Loop until done

```
while PR is not mergeable and not blocked:
  wait for new bot reviews (poll 30s, max 10 min per cycle)
  if actionable comments → fix → push → CI → resolve threads
  if no new comments and CI green → break
```

**Done when:**
- CI is green
- No unresolved actionable bot comments remain
- PR is mergeable OR explicitly blocked on human review

**Stop and report when:**
- Bot requests changes you cannot safely auto-fix (architectural disagreement, missing context)
- Required human approval is pending
- Merge conflicts need manual resolution → use `/fix-conflicts`

## Error Recovery

| Failure | Recovery |
|---|---|
| Pre-commit check fails | Fix locally, do not commit |
| Push rejected | `git pull --rebase origin <branch>`, resolve conflicts, push again |
| CI fails | Fix, commit, push, re-run check-watcher |
| Bot review unfixable | Summarize blocking items for human review |
| Network errors on push/fetch | Retry with exponential backoff (4s, 8s, 16s, 32s) |

## Related Skills

- `/commit` — commit only, no PR/CI
- `/create-pr` — PR only, no checks
- `/check-watcher` — CI monitoring only
- `/respond-to-review` — review comment handling in depth
- `/autobot` — bot review loop only (shipit supersedes for full pipeline)
- `/fix-conflicts` — merge conflict resolution
