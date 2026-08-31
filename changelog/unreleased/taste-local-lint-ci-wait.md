---
category: Changed
---

Taste waits in-process for product CI with a GitHub CLI or CircleCI CLI watch loop.
Before any push it always pulls latest `master`, then runs `bun lint` (and affected
tests) in a fresh subagent with no parent conversation, then pushes and watches CI.
Plugin `terreno-planning` is `2.5.0`.
