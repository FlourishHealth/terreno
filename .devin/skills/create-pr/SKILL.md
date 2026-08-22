---
name: create-pr
description: >-
  Create or update a draft PR using Terreno template and preservation
  conventions. Lifecycle composition: Brew after Roast proof.
---
# Create Pull Request

Create a pull request for the current branch.

## Instructions

1. First ensure changes are committed and pushed:
   ```
   git status
   git log origin/master..HEAD --oneline
   ```

2. If there are uncommitted changes, commit them first (run `/commit` command).

2b. If the branch changes public APIs (exports, components, routes, env vars), run the `update-docs` skill and include docs preview verification in the PR body.

2c. **Frontend verification gate:** If the branch touches `ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, or frontend-integrated `rtk/`, invoke `verify-ui-changes` before creating the PR: launch the app, log in, exercise the changed feature, save screenshots/videos to `/opt/cursor/artifacts/`, and include them in the PR body.

3. Push the branch if not already pushed:
   ```
   git push origin HEAD
   ```

4. Create the pull request:
   ```
   gh pr create --title "<title>" --body "<body>" --draft
   ```

   Guidelines for the PR:
   - Title: Plain-language outcome, at most 72 characters
   - Do not use prefix commit format (feat:, fix:, chore:, etc.)
   - Do not mention AI, Claude, or any AI assistant in the title or body
   - Do not add "Generated with Claude" or similar footers
   - Always create as draft
   - Sign every commit with DCO: `git commit -s` (see [CONTRIBUTING.md](CONTRIBUTING.md))

   **PR body:** Human attention is the limiting resource. Match
   [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md), keep the
   visible body under 250 words, and use exactly these top-level headings:

   ```markdown
   ## Why

   [Problem and impact in 1–2 sentences; include one issue/IP link if useful.]

   ## What changed

   - [Outcome or behavior; maximum five bullets.]

   ## Verification

   | Status | Scope | Evidence / action |
   | --- | --- | --- |
   | ✅ Tested | [Behavior or risk] | [`command` or artifact] |
   | ⚠️ Not tested | [Remaining risk] | [Exact reviewer action] |
   ```

   - Omit the `Not tested` row when nothing remains untested.
   - Say what each check proves; do not paste a command list without scope.
   - Do not add checklists, type-of-change sections, commit lists, or repeated criteria.
   - Put migration notes, logs, compatibility matrices, or unusual implementation detail
     in one optional `<details><summary>Details</summary>…</details>` block.
   - Frontend changes: embed only the minimum decisive screenshots/videos from
     `verify-ui-changes`. Do not add a fourth top-level heading.
   - Do not post a creation/readiness/test-summary comment. Update the body when evidence
     changes. Post only when a human decision is blocked and cannot be asked in a review
     thread.

5. Return the PR URL to the user.

## Arguments

$DESCRIPTION: Optional description for the PR title and body
