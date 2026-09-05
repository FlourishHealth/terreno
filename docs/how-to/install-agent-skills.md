# Install agent skills

Install Terreno's agent skills into another repo or agent with the skills CLI.

```bash
npx skills add FlourishHealth/terreno
npx skills add FlourishHealth/terreno --skill terreno-1-grow
```

That copies the committed `skills/` tree: lifecycle stages (Grow, Pick, Roast, Brew,
Taste), three outer loops, combined Terreno app workflows, and optional repository
skills.

## Install as a host plugin

The combined lifecycle and Terreno app workflows ship as one host plugin. Stage names
differ by host because Claude Code takes a plugin skill's command from the frontmatter
`name`.

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
Claude Code stages, app skills, and agents come from the generated copy at
[`plugins/terreno-claude/`](https://github.com/FlourishHealth/terreno/tree/master/plugins/terreno-claude).

## What you get

| Group | Skills |
| --- | --- |
| Lifecycle | `terreno-1-grow` … `terreno-5-taste`, `terreno-pick-roast-loop`, `terreno-planning-loop`, `terreno-taste-sweep` |
| Terreno apps | backend, UI, admin interfaces, data, schema, SDK, prompts, upgrades, deployment |
| Docs | `update-docs`, `update-agent-docs`, architecture skills |
| GitHub | issues, review, UI verification, release |
| Plugin agents | `pre-commit`, `ui-verifier` |

`skills.sh.json` at the repo root groups those names on [skills.sh](https://skills.sh).

## Keep copies in sync (Terreno maintainers)

Canonical sources:

1. `plugins/terreno-planning/skills/` — lifecycle and reusable Terreno app workflows
2. `plugins/terreno-planning/agents/` — reusable verification agents
3. `.rulesync/skills/` — repository-only and optional Expo skills (`bun run rules` generates agent copies)
4. `<package>/.ai/skills/` — package/MCP-specific copies; not installable overlays

`plugins/terreno-claude/` is generated from sources 1 and 2 with shortened lifecycle names.
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
