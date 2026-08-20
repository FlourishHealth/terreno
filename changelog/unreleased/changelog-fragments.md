---
category: Changed
---

Unreleased notes are one file per feature in `changelog/unreleased/` instead of a shared
`CHANGELOG.md` `## [Unreleased]` section. `docs/implementationPlans/PLAN_INDEX.md` is
removed for the same reason — status lives on each IP's `**Status:**` header. Parallel
PRs no longer conflict on those shared files.
