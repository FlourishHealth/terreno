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

## Step 1.5: Pre-Commit Checks

Delegate lint, type check, and related tests to the `pre-commit` subagent before committing.

Use the `Agent` tool:
- `subagent_type`: `pre-commit`
- `description`: `Run pre-commit checks`
- `prompt`: instruct it to run lint, compile, and related tests for the current project, fix any issues, and report back. Mention this is being run as part of `/submit` for an upcoming commit.

Wait for the subagent to return its Pre-Commit Report. If it surfaces unfixable failures, STOP and report them — do not commit or push.

If your harness does not support subagents, run the same checks inline instead: `bun run lint`, `bun run compile`, and tests related to the changed files.

If invoked from `/fullsend` (which already ran pre-commit), skip this step.

## Step 1.75: Frontend verification (mandatory when branch touches frontend)

If the branch changes files under `ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, or frontend-integrated `rtk/`:

1. Invoke the `verify-ui-changes` skill before committing or opening/updating the PR.
2. Launch the correct app, log in with seeded credentials when required, and exercise each changed user-facing feature.
3. Save screenshots and videos under `/opt/cursor/artifacts/`.
4. Carry the artifacts forward to Step 4 — they must appear in the PR `## Evidence` or `## UI verification` section.

Do not skip this step for full-stack features that include frontend paths. If verification is blocked by environment setup, document the blocker in the PR body.

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

## Step 4: Create or Update PR

### Include run evidence (screenshots/videos) — required for frontend changes

When the branch touches frontend paths (`ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, or frontend-integrated `rtk/`), the PR **must** include UI verification evidence from `verify-ui-changes`: app launch, login, and feature exercise with saved screenshots/videos.

For all runs, if evidence was captured — screenshots, screen recordings, or videos (e.g. from browser testing, `verify-ui-changes`, Playwright, or emulator sessions) — include it in the PR body under an `## Evidence` section (or `## UI verification` when the change is UI-focused):

- Check for media generated during the session (e.g. `/opt/cursor/artifacts/`, `.cursor/artifacts/`, test output dirs, or files you saved while verifying).
- In Cursor cloud runs, reference artifacts by absolute path with HTML tags — the PR tool uploads them and rewrites the URLs automatically: `<img alt="Description" src="/opt/cursor/artifacts/screenshots/example.png" />` or `<video src="/opt/cursor/artifacts/demo.mp4"></video>`.
- With `gh`, only include media you can reference by a stable URL (already-uploaded images); do not commit media files to the repo just to link them.
- Give each item a one-line caption saying what it demonstrates (app URL, login account if applicable, and feature exercised).
- For frontend changes, an empty Evidence section is not allowed unless verification was blocked — document the blocker instead.
- Skip the section entirely only when the branch has no frontend paths and no other evidence exists.

### If no PR exists

Use this template for the **initial** body only:

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
[What changed and why — 2-4 sentences]

## Human Testing Steps
- [ ] [Step-by-step verification instructions]

## Changes
- [Bullet list of specific changes]

## Automated Tests
- [Tests that ran and passed, or "None"]
EOF
)" --draft
```

Append an `## Evidence` section to the initial body when run evidence exists (see "Include run evidence" above).

### If a PR already exists

1. Read the current PR title and body, then compare against commits and diff on the branch:

```bash
gh pr view --json title,body,baseRefName
git log $(gh pr view --json baseRefName -q .baseRefName)..HEAD --oneline
git diff $(gh pr view --json baseRefName -q .baseRefName)...HEAD --stat
```

2. **Merge policy (mandatory):** Treat the `body` from `gh pr view` as the source document.

- **Do not replace the entire description** with a fresh template or a short stub. Build the next body by **editing a copy of the existing Markdown**.
- Keep narrative, reviewer context, links, embedded media/HTML, `<!-- -->` comments, and manual checklist edits unless they are factually wrong for the branch.
- Prefer **additive** updates: append bullets under **Changes** for new work; extend **Summary** with a brief "Update:" line (and date if helpful) when scope grows, instead of deleting the original explanation.
- Refresh **Human Testing Steps** / **Automated Tests** only when verification needs changed; add or adjust bullets rather than wiping sections unless an item is now false.
- If new work does not fit existing headings, add a **new section at the end** instead of removing unrelated content.
- If this run produced new evidence (screenshots/videos), add it under the existing `## Evidence` section, or create that section if missing — keep any evidence already in the body.
- Change the PR **title** only when the overall branch goal changed; otherwise keep the existing title.

3. Compare your merged draft against the `git log` / `git diff` output above. Revise only what is stale.

4. Apply the **full** merged body once (avoid shell quoting breakage):

```bash
gh pr edit --title "<title-or-keep-existing>" --body-file /tmp/submit-pr-body.md
```

Write `/tmp/submit-pr-body.md` with the complete merged Markdown. Do not pass a placeholder body.

If nothing needs changing, skip `gh pr edit` and tell the user the PR description is already current.

If you use a PR management tool instead of `gh`, apply the same policy: when supplying a `body`, pass the **full merged Markdown** only—never a template or stub that drops existing reviewer context unless the user explicitly asked for a full rewrite.

## Step 5: Print PR Link

```bash
gh pr view --json title,url -q '"**\(.title)** — \(.url)"'
```

## Step 6: Launch Check Watcher Sub-Agent

Spawn `/check-watcher` as a **background sub-agent** so CI monitoring runs autonomously without blocking the parent conversation. Use the `Agent` tool with `run_in_background: true`.

- `subagent_type`: `general-purpose`
- `description`: `Watch CI for current PR`
- `run_in_background`: `true`
- `prompt`: instruct the sub-agent to invoke the `/check-watcher` skill for the current PR, fix any failures, and report back when checks are green or max attempts are hit. Include the PR number/URL from Step 5 so the sub-agent has context.

Do **not** wait on the sub-agent — return control immediately after spawning. The user will be notified when it completes.

If your harness does not support background subagents, run the `/check-watcher` skill directly instead (blocking), or report the PR link and tell the user CI is unwatched.

By the time you reach this step, a PR is guaranteed to exist — either it pre-existed (from Step 1) or Step 4 just created it. Always spawn check-watcher.

## Arguments

$DESCRIPTION: Optional description to guide the commit message and PR
