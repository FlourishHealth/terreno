---
category: Changed
---

Architectural PR review and Maestro web E2E now run on CircleCI. Matching GitHub
workflows are retained with `on: []` for rollback. Cursor Approval Agent, Bugbot,
and Security Agent stay on GitHub (Cursor GitHub App automations, not repo
workflows).
