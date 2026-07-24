---
name: verify-ui-changes
description: >-
  Mandatory when any feature touches the frontend. Launch the app, log in,
  exercise the feature, save screenshots/videos, and post evidence to the PR.
---
# Verify UI Changes

Use this skill automatically whenever a task changes UI behavior, UI layout, visual styling, component stories, navigation screens, user-visible copy, or any full-stack feature with a frontend surface.

## Trigger Files

Load this skill before validating changes to:

- `*.tsx`
- `*.jsx`
- `*.html`
- `*.css`
- `*.scss`
- `*.less`
- `*.styl`
- `*.vue`
- Story/demo files that render UI states
- Theme, layout, navigation, or component configuration that changes rendered UI
- Full-stack PRs that include any of the above, even when backend files dominate the diff

## Mandatory Workflow (every frontend-touching feature)

Do not open or update a PR for frontend work until this workflow is complete.

1. **Launch the correct app** for the package that changed (see package-specific sections below).
2. **Log in** when the app requires authentication — use the seeded test accounts documented below.
3. **Attempt to use the changed feature** — navigate to the affected screen and exercise the primary user flow end to end, not just confirm the app or page loads.
4. **Save evidence** under `/opt/cursor/artifacts/`:
   - Screenshots for static visual states → e.g. `/opt/cursor/artifacts/screenshots/<feature>-<state>.png`
   - Screen recordings for interaction flows → e.g. `/opt/cursor/artifacts/<feature>-demo.mp4`
   - Use `RecordScreen` in Cursor Cloud for video walkthroughs.
5. **Post evidence to the PR** before finishing:
   - Add or update `## Evidence` or `## UI verification` in the PR body.
   - Reference artifacts with HTML tags and absolute paths, e.g. `<img alt="Todos list after filter" src="/opt/cursor/artifacts/screenshots/todos-filter.png" />` or `<video src="/opt/cursor/artifacts/todos-create.mp4" controls></video>`.
   - Use the PR management tool to create or update the PR body after artifacts exist.
   - List app URL(s) tested, credentials used, and which UI states/flows the media demonstrates.

If environment setup blocks verification, document the exact blocker and every command attempted in the PR body. Do not present compile-only or app-start-only checks as complete verification.

## Verification Requirements

1. Define the visible success state.
   - State what a skeptical reviewer should see on screen.
   - Include loading, empty, disabled, error, and responsive states when the change affects them.

2. Run targeted automated checks when available.
   - Prefer package-specific lint, compile, and component tests.
   - If the change only affects generated docs or static skill/rule text, use rulesync/static checks instead.

3. Perform mandatory manual UI verification.
   - Start the exact app listed below for the package that changed.
   - Use the browser or simulator to navigate to the changed UI.
   - Log in with seeded credentials when the app requires auth.
   - Exercise the changed interaction and the path that reaches it.
   - Capture a screenshot for static visual changes.
   - Capture a short video for interaction flows.

4. Critically review the evidence.
   - Check spacing, alignment, truncation, disabled/loading states, and error states.
   - Confirm the changed code path actually ran.
   - If the evidence is inconclusive, adjust the test and verify again.

5. Document limitations honestly.
   - If manual UI testing is blocked by environment setup, explain the exact blocker and list the commands or setup steps attempted.
   - Do not present compile-only or app-start-only checks as complete UI verification.

## Package-Specific Manual Verification

### `@terreno/ui` component changes

Test UI package component changes only in the demo app.

1. Start the demo web app from the repo root:

   ```bash
   bun run demo:start
   ```

   Or from `demo/`:

   ```bash
   bun run web
   ```

   The demo runs on `http://localhost:8085`.

2. Open the developer-mode screen for the changed component:

   ```text
   http://localhost:8085/dev
   ```

3. Select the component and the most relevant story.
   - Direct URLs use the component name from `demo/demoConfig.tsx` and a story query param, e.g. `http://localhost:8085/dev/Button?story=variants`.
   - Use the `/dev` route, not `/demo`, for reviewer verification because `/dev` exposes raw component states.

4. Verify the changed state and at least one adjacent state that could regress.
   - For visual primitives: compare default, disabled, loading, icon, and full-width states when relevant.
   - For interactive components: click, type, open, close, hover, and keyboard navigate as appropriate.

5. When shipping a **new** `@terreno/ui` component or changing public props, also verify the generated docs page:
   - Run `cd ui && bun run types && bun run website:generate`
   - Check the docs deploy preview (or `bun run website:build` locally) for the component page and embedded demo iframe.

Do not launch the example app to validate isolated `@terreno/ui` component changes unless the change also affects an app-level integration.

### `admin-frontend` and example app UI changes

Test `admin-frontend` changes in the example full-stack app.

1. Start the backend from the repo root:

   ```bash
   bun run backend:dev
   ```

   The backend runs on `http://localhost:4000`.

2. Seed login data in a separate terminal:

   ```bash
   cd example-backend && bun run seed
   ```

3. Start the frontend from the repo root:

   ```bash
   bun run frontend:web
   ```

   The frontend runs on `http://localhost:8082`.

4. Log in with the seeded admin account:
   - Email: `superuser@example.com`
   - Password: `testpassword123`

5. Navigate to the changed admin screen.
   - Admin home: `http://localhost:8082/admin`
   - Model table: `http://localhost:8082/admin/<modelName>`
   - Configuration: `http://localhost:8082/admin/configuration`
   - Consent forms: `http://localhost:8082/admin/consent-forms`
   - Consent responses: `http://localhost:8082/admin/consent-responses`

6. Verify both the changed screen and the path that gets the user there.
   - For list/table changes: verify loading, populated, empty, pagination, sorting, and row navigation when applicable.
   - For form changes: verify create/edit validation, save loading, cancel/back navigation, and error handling.
   - For admin cards/navigation: verify the card appears, the label/copy is correct, and click navigation still works.

### Other frontend package changes

- `example-frontend` user-facing screens: use `bun run backend:dev`, `cd example-backend && bun run seed`, and `bun run frontend:web`, then log in with `test@example.com` / `testpassword123`, navigate to the changed feature, and exercise it.
- Demo-only story changes: use the demo app `/dev` route and the story being changed.
- Generated SDK or API-surface-only frontend changes: combine targeted automated checks with an example app login + feature smoke test when a rendered UI path is affected.

## GitHub Reviewer Evidence

Post UI verification evidence to GitHub through the PR body so reviewers can see it without local setup.

- Save screenshots and videos under `/opt/cursor/artifacts`.
- Reference artifacts in the PR body with HTML tags, e.g. `<video src="/opt/cursor/artifacts/admin_model_list_demo.mp4" controls></video>`.
- Include a short "UI verification" section in the PR body that lists:
  - exact app URL(s) tested
  - credentials used when applicable
  - changed UI state(s) and flows exercised
  - screenshot/video artifact references
- Use the PR management tool to create or update the PR body after artifacts are available.
- Keep evidence minimal: one short video is preferred for interaction flows, plus one screenshot when it shows a static visual state more clearly.

## Cursor Cloud Notes

- Delegate GUI-driven verification to the `ui-verifier` subagent when your harness supports subagents; in Cursor Cloud, fall back to its built-in browser/GUI capability.
- Use `RecordScreen` for user-facing video walkthroughs of interactive UI changes.
- Leave test servers running after verification so the user can continue testing.

## Final Response Checklist

- Include the relevant screenshot or video artifact for UI changes.
- Prefix every command in the testing section with pass, warning, or fail status.
- Explain why each test or check was run.
- Mention any environment limitation only when it prevented expected UI verification.
- Confirm PR evidence was posted or will be posted before the PR is opened/updated.
