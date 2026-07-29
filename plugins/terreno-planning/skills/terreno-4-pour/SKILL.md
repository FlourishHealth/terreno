---
name: terreno-4-pour
description: Commit, push, and set up the PR, then hand off by loading plugins/terreno-planning/skills/terreno-5-dialin/SKILL.md (Cursor does not reliably invoke sibling plugin skills by name alone). Use ONLY when code is ready to enter review — not for implementation work, independent verification, or waiting on CI/comments after the PR is open.
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

**Frontend verification gate:** If the branch touches `ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, or frontend-integrated `rtk/`:

1. Invoke `verify-ui-changes` before commit/PR setup.
2. Launch the correct app, log in with seeded credentials when required, and exercise each changed user-facing feature.
3. Save screenshots and videos under `/opt/cursor/artifacts/`.
4. Do not open or update the PR until artifacts are ready to attach.

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
- **Include run evidence:** if any screenshots, screen recordings, or videos were captured during this run (browser testing, Playwright, emulator sessions, UI verification), add them to the PR body under an `## Evidence` section with a one-line caption per item. For frontend changes this section is **required** — include app URL, credentials used, feature exercised, and media from `verify-ui-changes`. In Cursor cloud runs, reference artifacts by absolute path with HTML tags (`<img src="/opt/cursor/artifacts/screenshots/example.png" />`, `<video src="/opt/cursor/artifacts/demo.mp4"></video>`) — the PR tool uploads them and rewrites URLs automatically. When updating an existing PR, append new evidence without removing what is already there. Skip the section only when the branch has no frontend paths and no other evidence exists.
- Apply PHI minimum-necessary handling in PR text, including evidence media — do not attach screenshots or recordings containing PHI.

### 5) Conflict resolution before handoff

If push/rebase/merge conflicts block PR update:

- Resolve conflicts.
- Re-run required checks.
- Commit and push conflict fix.

### 6) Handoff (required)

As soon as PR is open/updated and CI has been triggered on first push:

**Cursor / plugin caveat:** Skills inside `plugins/terreno-planning/skills/` are not always registered as separately invocable skills. Treat the markdown file as the source of truth.

1. Read `plugins/terreno-planning/skills/terreno-5-dialin/SKILL.md` from the repository root (same path on disk as this pour skill).
2. Execute the **Dial In** procedure from that file immediately — same turn if possible — without waiting for CI to finish.
3. Exit pour’s scope without blocking; Dial In owns the reactive loop from here.

Optional: if your Cursor/plugin setup exposes a `/terreno-5-dialin` slash command and it successfully loads that skill, you may use it **instead of** step 1–2 only when you have confirmed it resolves to the same `terreno-5-dialin/SKILL.md` content.

## Branch/Repo Conventions

- Use repository branch naming rules for cloud branches (`cursor/<descriptive-name>-dcb3`).
- Keep commit/PR text free of AI attribution.
