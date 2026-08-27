# Install agent skills

Install Terreno's agent skills into another repo or agent with the skills CLI.

```bash
npx skills add FlourishHealth/terreno
npx skills add FlourishHealth/terreno --skill 1-grow
```

That copies the committed `skills/` tree: lifecycle stages (Grow, Pick, Roast, Brew,
Taste), repository skills, and published package skills.

## Install as a host plugin

The same lifecycle stages ship as the `terreno` plugin for Cursor and Claude Code.
Skills live once under `plugins/terreno-planning/skills/`.

### Cursor

Install `terreno` from [`.cursor-plugin/marketplace.json`](https://github.com/FlourishHealth/terreno/blob/master/.cursor-plugin/marketplace.json), then invoke `/1-grow`.

### Claude Code

```text
/plugin marketplace add FlourishHealth/terreno
/plugin install terreno@terreno
/terreno:1-grow
```

Claude Code namespaces plugin skills as `/terreno:<skill>`. Marketplace:
[`.claude-plugin/marketplace.json`](https://github.com/FlourishHealth/terreno/blob/master/.claude-plugin/marketplace.json).

## What you get

| Group | Skills |
| --- | --- |
| Lifecycle | `1-grow` … `5-taste` |
| Terreno apps | backend, UI, data, schema, SDK |
| Docs | `update-docs`, `update-agent-docs`, architecture skills |
| GitHub | commit, PR, review, verify, release, deploy |

`skills.sh.json` at the repo root groups those names on [skills.sh](https://skills.sh).

## Keep copies in sync (Terreno maintainers)

Canonical sources:

1. `.rulesync/skills/` — repository skills (`bun run rules` generates agent copies)
2. `plugins/terreno-planning/skills/` — portable lifecycle stages
3. `<package>/.ai/skills/` — published package skills; these overlay the repo copies

Regenerate the installable tree:

```bash
bun run skills:sync
bun run check:lifecycle-skills
```

Do not hand-edit `skills/`.

## Write human docs with the skills

Skills read architecture docs before changing code. After a user-visible or architectural
change, update `docs/` in the same slice using `update-docs`. See
[lifecycle plugin](../reference/lifecycle-plugin.md) and the
[documentation contract](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/documentation-contract.md).
