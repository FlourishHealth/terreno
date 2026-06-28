---
name: terreno-cupping
description: Independently verify a completed implementation against the IP/spec with concrete evidence. Use ONLY when implementation already exists — not for writing feature code, planning the IP, or running the PR submission/review loop.
---

# Cupping

Independent verification of completed implementation against IP/spec, runnable even when the verifier did not author the PR.

## Verification Objective

- Prove or disprove that implementation matches intended scope and acceptance expectations.
- Produce concrete evidence (commands run, outputs, screenshots/videos when UI is involved).

## Standalone Entry

Cupping can run on:

- Local branch changes, or
- An existing PR owned by someone else (resolve PR, checkout/worktree as needed).

## Verification Workflow

1. Load source of truth (IP/spec, acceptance criteria, PR context).
2. Build a requirement-to-evidence checklist.
3. Run targeted automated checks for touched packages.
4. Run manual verification where automation is insufficient.
5. Record pass/fail per requirement with evidence.

## UI Verification Requirements

For UI-facing changes, include manual verification and visible artifacts.

### `@terreno/ui` changes

- Start demo (`bun run demo:start`).
- Validate changed states and interactions.
- Capture screenshots/video evidence.

### `admin-frontend` / example app UI changes

- Start backend + frontend example apps.
- Verify flows in browser.
- Use known test accounts when needed.
- Capture screenshots/video evidence.

### Other frontend package changes

- Run package-appropriate manual checks and capture evidence.

## Evidence Rules

- Save artifacts in `/opt/cursor/artifacts`.
- Include command outputs and media references needed for reviewer confidence.
- Report mismatches explicitly; do not mask failures.

## Output Structure

- Scope verified.
- Checks executed.
- Requirement-by-requirement outcome.
- Evidence references.
- Open defects/gaps (if any) with severity.
