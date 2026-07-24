---
name: terreno-3-cupping
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

For UI-facing changes, manual verification with login + feature exercise is **mandatory**.

1. Invoke the `verify-ui-changes` skill.
2. Launch the correct app for the package that changed.
3. Log in with seeded credentials when the app requires authentication.
4. Attempt to use each requirement's user-facing behavior — not just confirm the app loads.
5. Save screenshots and videos under `/opt/cursor/artifacts/`.
6. Include artifact references in the verification output for PR attachment.

### `@terreno/ui` changes

- Start demo (`bun run demo:start`).
- Open `/dev`, select the changed component/story.
- Validate changed states and interactions.
- Capture screenshots/video evidence.

### `admin-frontend` / example app UI changes

- Start backend + frontend example apps.
- Log in (`superuser@example.com` / `testpassword123` for admin; `test@example.com` / `testpassword123` for user flows).
- Navigate to the changed feature and exercise it in the browser.
- Capture screenshots/video evidence.

### Other frontend package changes

- Run package-appropriate manual checks with login + feature exercise when auth is required.
- Capture screenshots/video evidence.

## Evidence Rules

- Save artifacts in `/opt/cursor/artifacts`.
- Include command outputs and media references needed for reviewer confidence.
- Post media to the PR `## Evidence` or `## UI verification` section when cupping precedes or accompanies Pour.
- Report mismatches explicitly; do not mask failures.

## Output Structure

- Scope verified.
- Checks executed.
- Requirement-by-requirement outcome.
- Evidence references.
- Open defects/gaps (if any) with severity.
