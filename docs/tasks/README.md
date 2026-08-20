# Task lists

Bot-consumable execution checklists, one per implementation plan (IP). A task file is
the second half of the pair described in
[`docs/implementationPlans/README.md`](../implementationPlans/README.md):

- **IP** (`docs/implementationPlans/<slug>.md`) — the design: what and why.
- **Task list** (`docs/tasks/<slug>.md`) — the steps: the concrete, ordered work.

The filename slug matches the IP it belongs to.

## Task shape

Each task is a checkbox with four fields so it can be picked up and verified independently:

```markdown
- [ ] **Task 1.1**: Short title
  - Description: what to implement
  - Files: expected files to create or modify
  - Depends on: none | other task IDs
  - Acceptance: how to verify it is done
```

Group tasks by phase (`### Phase 1: …`). Order them by dependency — models first, then
APIs, then UI. Blend-style runs may append a **Plan vs Actual** log to the same file after
each task.

## What lives here vs elsewhere

| Concern | Home |
| ------- | ---- |
| Design, scope, acceptance criteria | the IP (`docs/implementationPlans/`) |
| Concrete task steps and their status | this directory |
| Public status and target | GitHub roadmap issue / Project (roadmap-enabled repos) |
| Sprint estimates and assignees | Linear |

Do not copy the full checklist into a GitHub issue or Linear. Create linked GitHub child
issues only for tasks that outside contributors should be able to claim independently; the
task file stays the source of truth for scope and acceptance.

The docs site excludes this directory, so link to task files with full GitHub URLs from
pages that render on the site.
