---
name: terreno-4-brew
description: Commit, push, and set up the PR, then hand off by loading plugins/terreno-planning/skills/terreno-5-taste/SKILL.md (Cursor does not reliably invoke sibling plugin skills by name alone). Use ONLY when code is ready to enter review — not for implementation work, independent verification, or waiting on CI/comments after the PR is open.
disable-model-invocation: true
---

# Brew

Get work into review, then immediately hand ownership to **Taste** by loading the taste skill from disk (see Handoff).

## Scope Boundary

Brew owns only pre-review-open and review-open actions:

1. Final pre-submit checks.
2. Independent code review.
3. Commit and push.
4. Create/update draft PR.
5. Resolve merge conflicts required to get PR updated; conflicts that appear after the handoff belong to Taste.
6. Ensure CI is triggered on the first push.
7. Immediately hand off to Taste using the path in Handoff (do not rely on skill-name-only invocation).

Brew must never block on CI completion or review comments.

## Procedure

### 1) Pre-submit checks

1. Run required lint and compile checks for touched areas.
2. Run **every workspace Bun test locally in agent-quiet mode**:

   ```bash
   bun run test:agent
   ```

   This is the required full-suite command. It uses Bun's `--only-failures` reporter mode so failures and the final summary remain visible without printing every passing test.
3. Inspect the diff for public API, component, route, configuration, setup, or environment changes. Invoke `update-docs` when applicable and verify the relevant reference/how-to/generated docs were updated. A checked PR-template box is not evidence; name the documentation files or record why docs are not applicable.
4. Run `bun run rules:check` when agent rules or `.rulesync/` skills changed.

Stop and fix before committing if checks fail.

**Frontend verification gate:** If the branch touches `ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, or frontend-integrated `rtk/`:

1. Invoke `verify-ui-changes` before commit/PR setup.
2. Launch the correct app, log in with seeded credentials when required, and exercise each changed user-facing feature.
3. Save screenshots and videos under `/opt/cursor/artifacts/`.
4. Do not open or update the PR until artifacts are ready to attach.

### 2) Independent code review

Spawn a fresh review sub-agent before committing:

- Read `plugins/terreno-planning/skills/terreno-code-review/SKILL.md` from the repository root.
- Use the PR base branch as the fixed point, or the repository default branch when no PR exists.
- Run its separate Standards and Spec axes against the full branch diff.
- Return concrete findings only; do not edit code in the review context.

Fix every material finding in the implementation context, rerun affected checks plus `bun run test:agent`, and repeat the review until both available axes are clean. If the harness cannot spawn sub-agents, stop and report that the mandatory independent review could not run.

### 3) Commit hygiene

- Review `git status`/`git diff`.
- Stage only relevant files.
- Commit with clear message.
- No AI attribution/co-author text.
- **DCO:** use `git commit -s` on every commit (see [CONTRIBUTING.md](../../../../CONTRIBUTING.md); enforced on external forks via `.github/workflows/dco.yml`).
- **Changelog:** add `changelog/unreleased/<feature>.md` with a YAML `category` header before opening the PR when the change is user-visible. Do not edit `CHANGELOG.md`.

### 4) Push branch

- Push with upstream.
- On network errors, retry with exponential backoff (4s, 8s, 16s, 32s).

### 5) PR setup

- Reuse existing PR if present; otherwise create draft PR.
- Read and apply [`.github/PULL_REQUEST_TEMPLATE.md`](../../../../.github/PULL_REQUEST_TEMPLATE.md) — GitHub pre-fills it on web PRs; match the same sections when using `gh pr create` or the PR management tool:
  - **Summary**, **Related IP or issue** (link IP, Grind task file, or `#issue`), **Type of change** (checkboxes), **Testing performed**, **Checklist** (lint, compile, tests, docs, changelog, DCO).
- Under **Testing performed**, record `bun run test:agent` and its pass/fail summary.
- Under **Checklist**, mark docs complete only after Step 1 identifies the updated files or records why documentation is not applicable.
- Keep PR title/body accurate and concise.
- **Include run evidence:** if any screenshots, screen recordings, or videos were captured during this run (browser testing, Playwright, emulator sessions, UI verification), add them under `## Evidence` after **Testing performed** with a one-line caption per item. For frontend changes this section is **required** — include app URL, credentials used, feature exercised, and media from `verify-ui-changes`. In Cursor cloud runs, reference artifacts by absolute path with HTML tags (`<img src="/opt/cursor/artifacts/screenshots/example.png" />`, `<video src="/opt/cursor/artifacts/demo.mp4"></video>`) — the PR tool uploads them and rewrites URLs automatically. When updating an existing PR, append new evidence without removing what is already there. Skip the section only when the branch has no frontend paths and no other evidence exists.
- Apply sensitive-data minimum-necessary handling in PR text, including evidence media — do not attach screenshots or recordings containing credentials, customer data, PII, or other regulated information.

### 6) Conflict resolution before handoff

If push/rebase/merge conflicts block PR update:

- Resolve conflicts.
- Re-run required checks.
- Rerun `bun run test:agent`.
- Rerun the independent code review when conflict resolution changes behavior.
- Commit and push conflict fix.

### 7) Handoff (required)

As soon as PR is open/updated and CI has been triggered on first push:

**Cursor / plugin caveat:** Skills inside `plugins/terreno-planning/skills/` are not always registered as separately invocable skills. Treat the markdown file as the source of truth.

1. Read `plugins/terreno-planning/skills/terreno-5-taste/SKILL.md` from the repository root (same path on disk as this Brew skill).
2. Execute the **Taste** procedure from that file immediately — same turn if possible — without waiting for CI to finish.
3. Exit Brew’s scope without blocking; Taste owns the reactive loop from here.

Optional: if your Cursor/plugin setup exposes a `/terreno-5-taste` slash command and it successfully loads that skill, you may use it **instead of** step 1–2 only when you have confirmed it resolves to the same `terreno-5-taste/SKILL.md` content.

## Branch/Repo Conventions

- Use the cloud-agent branch convention from your run instructions: `cursor/<descriptive-name>-<run-suffix>`. Do not hardcode a literal suffix from this skill — use the suffix your agent session was given.
- Keep commit/PR text free of AI attribution.
