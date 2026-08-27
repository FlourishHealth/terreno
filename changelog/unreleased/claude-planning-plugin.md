---
category: Added
---

The lifecycle stages now ship as a Claude Code plugin. Add the marketplace with
`/plugin marketplace add FlourishHealth/terreno`, install with
`/plugin install terreno@terreno`, then invoke `/terreno:1-grow`. Claude Code takes a
plugin skill's command from the frontmatter `name`, so its shortened stage names
(`1-grow` … `5-taste`) ship as a generated copy at `plugins/terreno-claude/`
(`bun run skills:sync`). Cursor and `npx skills` are unchanged: plugin
`terreno-planning`, stages `terreno-1-grow` … `terreno-5-taste`.
