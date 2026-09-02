---
category: Added
---

The lifecycle stages now ship as a Codex plugin. Add the marketplace with
`codex plugin marketplace add FlourishHealth/terreno`, install with
`codex plugin install terreno-planning --source terreno-plugins`, then invoke
`$terreno-1-grow`. Codex uses the canonical `plugins/terreno-planning/` tree
(`.codex-plugin/plugin.json`) and the repo marketplace at
`.agents/plugins/marketplace.json`. Stage names match Cursor and `npx skills`.
