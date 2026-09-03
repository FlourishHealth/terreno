---
category: Changed
---

Roast no longer asks two unconstrained subagents to each rediscover the repository
(full-branch diff plus skill catalog). Pick, Roast, and Brew pass a task-scoped
briefing (`plugins/terreno-planning/references/subagent-briefing.md`): this task's
criteria, file list, and patch. Roast may spawn at most one UI/runtime verifier when
this task lists UI files, and must not spawn a conventions reviewer. Installable
lifecycle skills copy only the plugin references they link. Plugin `terreno-planning`
is `2.6.0`.
