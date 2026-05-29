---
name: submit
description: Lightweight pre-commit + commit + push + create/update PR, then spawn check-watcher in the background. Use /fullsend for the full pipeline with code review.
---
# Submit: Quick Commit & PR

Lightweight path to run pre-commit checks, commit, push, and monitor CI. After pushing, this skill launches `/check-watcher` as a background sub-agent so CI is watched without blocking. Use `/fullsend` for the full pipeline that also includes code review.

## Step 1: Assess Changes

```bash
git status && git diff --stat
```

```bash
gh pr view --json number -q .number 2>/dev/null || echo "no-pr"
```

## Step 1.25: Feature Proof (UI-facing changes)

If the diff touches user-visible surfaces (`ui/`, `example-frontend/`, `demo/`, `admin-frontend/`, or backend routes used by those apps), invoke `/verify-feature` **before committing**:

1. Run `bun run stack:dev` (or confirm stack is up)
2. Capture proof: `bun run proof:web [flow]` (preferred), `bun run proof:native [flow]`, or `bun run proof:sim` on macOS
3. Show key screenshots/video in the agent session
4. After push (Step 3), run `bun run proof:attach --summary "..."`

Skip this step for docs-only, pure refactors, or backend-only changes with no UI impact.

## Step 1.5: Pre-Commit Checks

Delegate lint, type check, and related tests to the `pre-commit` subagent before committing.

Use the `Agent` tool:
- `subagent_type`: `pre-commit`
- `description`: `Run pre-commit checks`
- `prompt`: instruct it to run lint, compile, and related tests for the current project, fix any issues, and report back. Mention this is being run as part of `/submit` for an upcoming commit.

Wait for the subagent to return its Pre-Commit Report. If it surfaces unfixable failures, STOP and report them — do not commit or push.

If invoked from `/fullsend` (which already ran pre-commit), skip this step.

## Step 2: Commit

Stage and commit:
- Review the diff to write an accurate message
- Keep first line under 72 characters
- No conventional commit prefixes
- No AI attribution

## Step 3: Push

```bash
git push origin HEAD
```

If Step 1.25 ran, attach proof to the PR now:

```bash
bun run proof:attach --summary "<what was verified>"
```

## Step 4: Create or Update PR

New PRs start as **draft**. `/check-watcher` marks them ready for review once CI is green and bot reviews (Bugbot, Copilot) are fixed or acknowledged.

### If no PR exists

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
[What changed and why — 2-4 sentences]

## Feature Proof
- **Platform:** [Web / iOS sim / Maestro / None]
- **Steps:** [What you exercised locally]
- **Result:** [Pass + notes]
- **Artifacts:** [.proof/pr-N/... or "see PR comment"]

## Human Testing Steps
- [ ] [Step-by-step verification instructions]

## Changes
- [Bullet list of specific changes]

## Automated Tests
- [Tests that ran and passed, or "None"]
EOF
)" --draft
```

### If a PR already exists

Read the current title and body, then compare against the full set of commits on the branch:

```bash
gh pr view --json title,body,baseRefName,isDraft
git log $(gh pr view --json baseRefName -q .baseRefName)..HEAD --oneline
git diff $(gh pr view --json baseRefName -q .baseRefName)...HEAD --stat
```

Decide whether the description still reflects what's on the branch — pay attention to commits added since the PR was opened:
- **Summary** still matches the actual goal of the changes
- **Feature Proof** documents local verification (platform, steps, artifacts)
- **Changes** list covers the new commits, not just the original ones
- **Human Testing Steps** still cover what reviewers need to verify
- **Automated Tests** section reflects current test state

If the description is stale or incomplete, update it. Preserve sections the user has clearly edited by hand — only rewrite what's actually out of date, and merge new bullets into existing lists rather than replacing them wholesale:

```bash
gh pr edit --title "<title>" --body "$(cat <<'EOF'
<updated body>
EOF
)"
```

If the description is already accurate, skip the edit and note that it's up to date.

## Step 5: Print PR Link

```bash
gh pr view --json title,url,isDraft -q '"**\(.title)**\(if .isDraft then " (draft)" else "" end) — \(.url)"'
```

## Step 6: Launch Check Watcher Sub-Agent

Spawn `/check-watcher` as a **background sub-agent** so CI monitoring runs autonomously without blocking the parent conversation. Use the `Agent` tool with `run_in_background: true`.

- `subagent_type`: `general-purpose`
- `description`: `Watch CI for current PR`
- `run_in_background`: `true`
- `prompt`: instruct the sub-agent to invoke the `/check-watcher` skill for the current PR, fix any failures, address or acknowledge Bugbot and Copilot review comments, mark the PR ready for review when all gates pass, and report back. Include the PR number/URL from Step 5 so the sub-agent has context.

Do **not** wait on the sub-agent — return control immediately after spawning. The user will be notified when it completes.

By the time you reach this step, a PR is guaranteed to exist — either it pre-existed (from Step 1) or Step 4 just created it. Always spawn check-watcher.

## Arguments

$DESCRIPTION: Optional description to guide the commit message and PR
