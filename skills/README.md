# Installable Terreno skills

Install from GitHub with the skills CLI:

```bash
npx skills add FlourishHealth/terreno
npx skills add FlourishHealth/terreno --skill terreno-1-grow
```

This directory is generated. Canonical sources:

| Source | Owns |
| --- | --- |
| `plugins/terreno-planning/skills/` | Grow, Pick, Roast, Brew, Taste, plus continuous Pick-Roast, planning, and taste-sweep loops |
| `.rulesync/skills/` | Repository and domain skills |
| `<package>/.ai/skills/` | Published package skills (overlay the repo copies) |

Regenerate with `bun run skills:sync`. Human-facing docs stay the architecture source;
follow `update-docs` and the lifecycle documentation contract.
