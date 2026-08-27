# Terreno plugins

## `terreno-planning` — loop-engineering lifecycle

The reusable Cursor plugin exposes exactly five bounded lifecycle transitions:

| # | Stage | Contract |
| --- | --- | --- |
| 1 | **Grow** (`terreno-1-grow`) | Research, clarify, shape, and approve the IP/tasks |
| 2 | **Pick** (`terreno-2-pick`) | Build one approved slice with TDD and internal review |
| 3 | **Roast** (`terreno-3-roast`) | Independently prove/disprove the IP criteria |
| 4 | **Brew** (`terreno-4-brew`) | Final checks, commit/push, PR/evidence, wait for review bots, then exit |
| 5 | **Taste** (`terreno-5-taste`) | Wait for review bots, one current-head CI/mergeability/review reaction, then exit |

Each stage is `disable-model-invocation`: the outer loop or human invokes it explicitly.
Stages never own the full orchestration.

## Composition

```text
lifecycle stage
      +
repository/domain skills
      +
IP + task + execution state
      +
current evidence
```

The plugin owns portable stage method and transition contracts. Repository-local skills
own exact commands, frameworks, architecture, test environments, generated-code rules,
safety policies, and gotchas. Every stage discovers available project skills by
description; no Terreno-specific skill name is a plugin dependency.

The shared result/state format and outer state machine live in:

- [`references/lifecycle-contract.md`](terreno-planning/references/lifecycle-contract.md)
- [`references/documentation-contract.md`](terreno-planning/references/documentation-contract.md)
- [`references/async-review-bots.md`](terreno-planning/references/async-review-bots.md)
- [`references/loop-engineering.md`](terreno-planning/references/loop-engineering.md)
- [`references/github-attention-contract.md`](terreno-planning/references/github-attention-contract.md)
- [`stage-result.schema.json`](terreno-planning/references/stage-result.schema.json)
- [`execution-state.schema.json`](terreno-planning/references/execution-state.schema.json)

Stage YAML is compact (`v: 2`, omit empty keys) and collapsed behind a Details toggle in
chat and on the PR. Humans read `status`, `next`, and `action`.

The optional **feature profile** in the loop document preserves the former Grind behavior:
one fresh Pick invocation per frontier task. It is an outer-loop recipe, not a sixth
lifecycle stage.

## State machine

```text
Grow PASS → Pick PASS → Roast PASS → Brew PASS → Taste
                       ↘ Roast FAIL → Pick (exact evidence)
Brew PENDING (review-bot timeout) → outer loop waits → Taste
Taste PENDING (product CI / bot timeout / new push) → outer loop waits → fresh Taste
Taste PASS → merge-ready
Any BLOCKED → named human/external gate
```

Brew does not execute Taste. Brew and Taste sleep until Bugbot, CodeQL, and similar
review bots on the current head have reported, then continue. They do not wait for
ordinary product CI. The loop owns persistence, product-CI waiting, retry, stop, and
escalation.

## Repository integration

Terreno's project skills remain canonical under `.rulesync/skills/` and are generated for
supported agent ecosystems with `bun run rules`. They are not bundled into this plugin.
Examples include API/UI/data conventions, test environments, schema safety, prompt
governance, documentation, and runtime/UI verification.

Install the same set (plugin stages plus repo and package skills) with:

```bash
npx skills add FlourishHealth/terreno
bun run skills:sync
```

`skills/` is generated: `.rulesync/skills/` first, then plugin stages, then
`<package>/.ai/skills/` overlays. Stages read architecture docs first and update them
in the same slice; see
[`documentation-contract.md`](terreno-planning/references/documentation-contract.md).

Validate the plugin architecture with:

```bash
bun run check:lifecycle-skills
bun run rules:check
```

## Migration

| Retired | Canonical |
| --- | --- |
| `terreno-1-blend` | `terreno-1-grow` |
| `terreno-2-roast` (implementation) | `terreno-2-pick` |
| `terreno-3-cupping` | `terreno-3-roast` (verification) |
| `terreno-4-pour` | `terreno-4-brew` |
| `terreno-5-dialin` | `terreno-5-taste` |

No aliases are retained for the five retired plugin command names. The old
implementation-Roast name collides semantically with the new verification-Roast stage.
Deprecated repo-local routers (`/ip`, `/implement`, `/submit`, `/autobot`, `/check-watcher`)
are removed; invoke the canonical stages directly.

Install `terreno-planning` from either host marketplace, then invoke a canonical
stage:

| Host | Marketplace | Install |
| --- | --- | --- |
| Cursor | [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json) | install `terreno-planning`, then `/terreno-1-grow` |
| Claude Code | [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) | `/plugin marketplace add FlourishHealth/terreno`, then `/plugin install terreno-planning@terreno`, then `/terreno-planning:terreno-1-grow` |

Both manifests point at the same `plugins/terreno-planning/skills/` tree. Claude Code
namespaces plugin skills as `/terreno-planning:<skill>`.
