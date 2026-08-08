---
description: >-
  Mandatory frontend feature verification — launch app, login, exercise feature,
  capture evidence, attach to PR
applyTo: 'ui/**,demo/**,example-frontend/**,admin-frontend/**,admin-spa/**,rtk/**'
---
# Frontend Feature Verification (Mandatory)

Any feature, fix, or PR that touches the frontend MUST be verified in a running app before the PR is opened or updated.

This applies to work in `ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, and frontend-integrated changes in `rtk/`, including full-stack features where only part of the diff is backend.

## Required workflow

1. **Launch the correct app** for the package that changed (see `verify-ui-changes` skill for package-specific commands).
2. **Log in** when the app requires authentication — use seeded test accounts from `AGENTS.md` / `00-root.md`.
3. **Attempt to use the changed feature** — navigate to the affected screen and exercise the primary user flow end to end. App start or page load alone is not sufficient.
4. **Save evidence** — store screenshots and screen recordings under `/opt/cursor/artifacts/` (e.g. `/opt/cursor/artifacts/screenshots/`, `/opt/cursor/artifacts/` for videos).
5. **Post evidence to the PR** — include artifacts in the PR body under `## Evidence` or `## UI verification` using HTML tags with absolute paths. The PR management tool uploads them and rewrites URLs automatically.

## When this applies

- New or changed screens, components, navigation, forms, tables, modals, or user-visible copy
- Full-stack features with any frontend surface area
- `terreno-2-roast` (before handoff to Pour), `terreno-4-pour`, `/submit`, `/autobot`, and `/create-pr` when the branch includes frontend paths
- `terreno-5-dialin` when a fix cycle changes frontend files — re-verify and update PR evidence

## Skill reference

Follow the `verify-ui-changes` skill for package-specific app URLs, credentials, and capture guidance. Delegate GUI work to the `ui-verifier` subagent when available.

## Blockers

If environment setup prevents verification (no MongoDB, no browser, port conflict), document the exact blocker and every setup command attempted in the PR body. Do not claim verification passed when it was not run.
