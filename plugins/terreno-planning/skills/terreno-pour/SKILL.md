---
name: terreno-pour
description: Commit, push, and set up the PR, then hand off by loading plugins/terreno-planning/skills/terreno-dialin/SKILL.md (Cursor does not reliably invoke sibling plugin skills by name alone). Use ONLY when code is ready to enter review — not for implementation work, independent verification, or waiting on CI/comments after the PR is open.
disable-model-invocation: true
---

# Pour

Get work into review, then immediately hand ownership to **Dial In** by loading the dialin skill from disk (see Handoff).

## Scope Boundary

Pour owns only pre-review-open and review-open actions:

1. Final pre-submit checks.
2. Commit and push.
3. Create/update draft PR.
4. Resolve merge conflicts required to get PR updated.
5. Ensure CI is triggered on the first push.
6. Immediately hand off to Dial In using the path in Handoff (do not rely on skill-name-only invocation).

Pour must never block on CI completion or review comments.

## Procedure

### 1) Pre-submit checks

Run required checks for touched areas (lint/compile + targeted tests).
Stop and fix before committing if checks fail.

### 2) Commit hygiene

- Review `git status`/`git diff`.
- Stage only relevant files.
- Commit with clear message.
- No AI attribution/co-author text.

### 3) Push branch

- Push with upstream.
- On network errors, retry with exponential backoff (4s, 8s, 16s, 32s).

### 4) PR setup

- Reuse existing PR if present; otherwise create draft PR.
- Read and apply PR template if present.
- Keep PR title/body accurate and concise.
- Include human testing steps and automated checks sections.
- Apply PHI minimum-necessary handling in PR text.

### 5) Conflict resolution before handoff

If push/rebase/merge conflicts block PR update:

- Resolve conflicts.
- Re-run required checks.
- Commit and push conflict fix.

### 6) Handoff (required)

As soon as PR is open/updated and CI has been triggered on first push:

**Cursor / plugin caveat:** Skills inside `plugins/terreno-planning/skills/` are not always registered as separately invocable skills. Treat the markdown file as the source of truth.

1. Read `plugins/terreno-planning/skills/terreno-dialin/SKILL.md` from the repository root (same path on disk as this pour skill).
2. Execute the **Dial In** procedure from that file immediately — same turn if possible — without waiting for CI to finish.
3. Exit pour’s scope without blocking; Dial In owns the reactive loop from here.

Optional: if your Cursor/plugin setup exposes a `/terreno-dialin` slash command and it successfully loads that skill, you may use it **instead of** step 1–2 only when you have confirmed it resolves to the same `terreno-dialin/SKILL.md` content.

## Branch/Repo Conventions

- Use repository branch naming rules for cloud branches (`cursor/<descriptive-name>-dcb3`).
- Keep commit/PR text free of AI attribution.
