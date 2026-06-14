---
name: terreno-pour
description: Use ONLY when code is ready to enter review and the task is to perform commit/push/PR setup plus immediate handoff. Do NOT use for implementation work, independent verification, or waiting on CI/comments after the PR is open.
disable-model-invocation: true
---

# Pour

Get work into review, then immediately hand ownership to `terreno-dialin`.

## Scope Boundary

Pour owns only pre-review-open and review-open actions:

1. Final pre-submit checks.
2. Commit and push.
3. Create/update draft PR.
4. Resolve merge conflicts required to get PR updated.
5. Ensure CI is triggered on the first push.
6. Immediately invoke `terreno-dialin`.

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

- Invoke `terreno-dialin` immediately.
- Exit `terreno-pour` without waiting.

## Branch/Repo Conventions

- Use repository branch naming rules for cloud branches (`cursor/<descriptive-name>-dcb3`).
- Keep commit/PR text free of AI attribution.
