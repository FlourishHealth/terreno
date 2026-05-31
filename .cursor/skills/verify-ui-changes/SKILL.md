---
name: verify-ui-changes
description: Use automatically when making, reviewing, or validating UI changes in React, React Native, Expo, CSS, HTML, or component/story files.
---
# Verify UI Changes

Use this skill automatically whenever a task changes UI behavior, UI layout, visual styling, component stories, navigation screens, or user-visible copy in frontend files.

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

## Verification Requirements

1. Define the visible success state.
   - State what a skeptical reviewer should see on screen.
   - Include loading, empty, disabled, error, and responsive states when the change affects them.

2. Run targeted automated checks when available.
   - Prefer package-specific lint, compile, and component tests.
   - If the change only affects generated docs or static skill/rule text, use rulesync/static checks instead.

3. Perform manual UI verification for non-trivial UI changes.
   - Start the relevant app or storybook/demo.
   - Use the browser or simulator to navigate to the changed UI.
   - Exercise the changed interaction, not just the page load.
   - Capture a screenshot for static visual changes.
   - Capture a short video for interaction flows.

4. Critically review the evidence.
   - Check spacing, alignment, truncation, disabled/loading states, and error states.
   - Confirm the changed code path actually ran.
   - If the evidence is inconclusive, adjust the test and verify again.

5. Document limitations honestly.
   - If manual UI testing is blocked by environment setup, explain the exact blocker and list the commands or setup steps attempted.
   - Do not present compile-only or app-start-only checks as complete UI verification.

## Cursor Cloud Notes

- Use the `computerUse` subagent for GUI-driven verification.
- Use `RecordScreen` for user-facing video walkthroughs of interactive UI changes.
- Leave test servers running after verification so the user can continue testing.

## Final Response Checklist

- Include the relevant screenshot or video artifact for UI changes.
- Prefix every command in the testing section with pass, warning, or fail status.
- Explain why each test or check was run.
- Mention any environment limitation only when it prevented expected UI verification.
