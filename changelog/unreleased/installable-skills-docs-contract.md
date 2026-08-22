---
category: Changed
---

Lifecycle stages now follow a documentation contract: read architecture docs before
acting, update them in the same slice, and fail user-visible or architectural work that
ships without matching docs. All agent skills are installable with
`npx skills add FlourishHealth/terreno`. The committed `skills/` tree is generated from
`.rulesync/skills/`, the planning plugin stages, and `<package>/.ai/skills/` overlays via
`bun run skills:sync`.
