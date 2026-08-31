---
category: Changed
---

Taste waits in-process for product CI with a GitHub CLI or CircleCI CLI watch loop,
and before any push spawns a fresh subagent with no parent conversation to run
`bun lint` in each affected package plus the locally affected tests. Plugin
`terreno-planning` is `2.5.0`.
