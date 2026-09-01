# Install agent skills

Install Terreno's agent skills into another repo or agent with the skills CLI.

```bash
npx skills add FlourishHealth/terreno
npx skills add FlourishHealth/terreno --skill terreno-1-grow
```

That copies the committed `skills/` tree: lifecycle stages (Grow, Pick, Roast, Brew,
Taste), outer loops (`terreno-planning-loop`, `terreno-taste-sweep`), repository
skills, and published package skills.

## Install as a host plugin

The same lifecycle stages ship as a host plugin. Stage names differ by host because
Claude Code takes a plugin skill's command from the frontmatter `name`.

| Host | Plugin | Invoke Grow |
| --- | --- | --- |
| Cursor | `terreno-planning` | `/terreno-1-grow` |
| Codex | `terreno-planning` | `$terreno-1-grow` |
| Claude Code | `terreno` | `/terreno:1-grow` |

### Cursor

Install `terreno-planning` from [`.cursor-plugin/marketplace.json`](https://github.com/FlourishHealth/terreno/blob/master/.cursor-plugin/marketplace.json), then invoke `/terreno-1-grow`.

### Codex

```text
codex plugin marketplace add FlourishHealth/terreno
codex plugin install terreno-planning --source terreno-plugins
$terreno-1-grow
```

Marketplace: [`.agents/plugins/marketplace.json`](https://github.com/FlourishHealth/terreno/blob/master/.agents/plugins/marketplace.json).
Codex installs the canonical plugin at
[`plugins/terreno-planning/`](https://github.com/FlourishHealth/terreno/tree/master/plugins/terreno-planning)
(`.codex-plugin/plugin.json`). A clone of this repo already exposes that marketplace.

### Claude Code

```text
/plugin marketplace add FlourishHealth/terreno
/plugin install terreno@terreno-plugins
/terreno:1-grow
```

Marketplace: [`.claude-plugin/marketplace.json`](https://github.com/FlourishHealth/terreno/blob/master/.claude-plugin/marketplace.json).
Claude Code stages come from the generated copy at
[`plugins/terreno-claude/`](https://github.com/FlourishHealth/terreno/tree/master/plugins/terreno-claude).

## What you get

| Group | Skills |
| --- | --- |
| Lifecycle | `terreno-1-grow` … `terreno-5-taste`, `terreno-planning-loop`, `terreno-taste-sweep` |
| Terreno apps | backend, UI, admin interfaces, data, schema, SDK |
| Docs | `update-docs`, `update-agent-docs`, architecture skills |
| GitHub | commit, issues, PR, review, verify, release, deploy |

`skills.sh.json` at the repo root groups those names on [skills.sh](https://skills.sh).

## Keep copies in sync (Terreno maintainers)

Canonical sources:

1. `.rulesync/skills/` — repository skills (`bun run rules` generates agent copies)
2. `plugins/terreno-planning/skills/` — portable lifecycle stages
3. `<package>/.ai/skills/` — published package skills; these overlay the repo copies

`plugins/terreno-claude/` is generated from source 2 with shortened stage names.
Codex uses the canonical plugin plus committed `.codex-plugin/plugin.json` and
`.agents/plugins/marketplace.json` — do not generate a third plugin tree.

Regenerate the installable tree and the Claude plugin:

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
