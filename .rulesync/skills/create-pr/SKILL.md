---
name: create-pr
description: Create a draft pull request for the current branch
disable-model-invocation: true
claudecode:
  model: haiku
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
   - Title: Clear, concise summary of the changes
   - Do not use prefix commit format (feat:, fix:, chore:, etc.)
   - Do not mention AI, Claude, or any AI assistant in the title or body
   - Do not add "Generated with Claude" or similar footers
   - Always create as draft
   - Sign every commit with DCO: `git commit -s` (see [CONTRIBUTING.md](CONTRIBUTING.md))

   **PR body:** Match [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md). GitHub pre-fills this template on new PRs; when using `gh pr create`, supply the same sections:

   ```markdown
   ## Summary

   [What changed and why — 2-4 sentences]

   ## Related IP or issue

   [#NNN or docs/implementationPlans/<slug>.md]

   ## Type of change

   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation
   - [ ] Chore / CI

   ## Testing performed

   [Commands run, manual steps. Frontend changes: attach screenshots or video per AGENTS.md]

   ## Checklist

   - [ ] Tests added or updated where appropriate
   - [ ] `bun run lint` passes
   - [ ] `bun run compile` passes (if TypeScript changed)
   - [ ] Docs updated (if user-facing behavior changed)
   - [ ] `changelog/unreleased/<feature>.md` added for user-facing changes
   - [ ] DCO signed off (`git commit -s`) on every commit
   ```

   **Frontend evidence (required when branch touches `ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, or frontend-integrated `rtk/`):** Add an `## Evidence` section after **Testing performed** with screenshots/videos from `verify-ui-changes` (`/opt/cursor/artifacts/`). In Cursor cloud runs, reference artifacts with HTML tags — the PR tool uploads and rewrites URLs.

5. Return the PR URL to the user.

## Arguments

$DESCRIPTION: Optional description for the PR title and body
