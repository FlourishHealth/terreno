# Terreno plugins

## `terreno-planning` — loop-engineering lifecycle

The reusable plugin exposes exactly five bounded lifecycle transitions. Cursor and Codex
install it as `terreno-planning`; Claude Code installs the generated `terreno-claude/`
copy as `terreno` (see [Hosts](#hosts)):

| # | Stage | Contract |
| --- | --- | --- |
| 1 | **Grow** (`terreno-1-grow`) | Research, clarify, shape, and approve the IP/tasks |
| 2 | **Pick** (`terreno-2-pick`) | Build one slice, roast it, then pick the next until the list is done |
| 3 | **Roast** (`terreno-3-roast`) | Prove the current task, then continue the pick-roast inner loop |
| 4 | **Brew** (`terreno-4-brew`) | Final checks, commit/push, PR/evidence, confirm product CI on every discovered host, wait for review bots, then exit |
| 5 | **Taste** (`terreno-5-taste`) | Wait for review bots and product CI, one current-head reaction; before push: pull latest `master`, then `bun lint` in a no-context subagent, then push and watch |

Each stage is `disable-model-invocation`: the outer loop or human invokes it explicitly.
Grow, Brew, and Taste never own the full orchestration. Pick and Roast own the inner
loop that implements one task, roasts it, then picks the next until the list is done.

Two additional skills are **outer loops**, not stages. They invoke the five transitions
and persist state:

| Skill | Loop |
| --- | --- |
| **Planning loop** (`terreno-planning-loop`) | Walk Grow/Pick/Brew/Taste. Default Grow once, then Pick once (Pick owns pick-roast). Pass `phases=` to restrict. |
| **Taste sweep** (`terreno-taste-sweep`) | Find the author's open non-draft PRs that are conflicting or failing, isolate each one, and reinvoke Taste until mergeable or blocked. |

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
- [`references/pick-roast-loop.md`](terreno-planning/references/pick-roast-loop.md)
- [`references/documentation-contract.md`](terreno-planning/references/documentation-contract.md)
- [`references/async-review-bots.md`](terreno-planning/references/async-review-bots.md)
- [`references/product-ci.md`](terreno-planning/references/product-ci.md)
- [`references/loop-engineering.md`](terreno-planning/references/loop-engineering.md)
- [`references/github-attention-contract.md`](terreno-planning/references/github-attention-contract.md)
- [`references/product-ci.md`](terreno-planning/references/product-ci.md)
- [`stage-result.schema.json`](terreno-planning/references/stage-result.schema.json)
- [`execution-state.schema.json`](terreno-planning/references/execution-state.schema.json)

Stage YAML is compact (`v: 2`, omit empty keys) and collapsed behind a Details toggle in
chat and on the PR. Humans read `status`, `next`, and `action`.

The optional **feature profile** in the loop document preserves the former Grind behavior:
invoke Pick once; it pick-roasts each frontier task in sequence. `terreno-planning-loop`
is the invocable outer recipe (optional phases including Grow, Brew, Taste). Neither is
a sixth lifecycle stage.

## State machine

```text
Grow PASS → Pick/Roast inner loop → Brew PASS → Taste
              Pick one task → Roast that task
              Roast FAIL → Pick (same task, exact evidence)
              Roast PASS + remaining tasks → Pick (next frontier task)
              Roast PASS + no remaining tasks → Brew
Brew PENDING (review-bot timeout) → outer loop waits → Taste
Taste PENDING (CI wait timeout / bot timeout / second push) → outer loop waits → fresh Taste
Taste PASS → merge-ready
Any BLOCKED → named human/external gate
```

Brew does not execute Taste. Pick never skips Roast. Roast never invokes Pick. Exactly
one driver continues after each current-task Roast. Brew and Taste wait until Bugbot,
CodeQL, and similar review bots on the current head have reported, preferring provider
CLI watch hooks or harness event subscriptions over sleep polling, then continue. Taste
then waits in a loop for product CI using GitHub CLI or CircleCI CLI until jobs are
terminal or the wait times out. Before any push, Taste always pulls latest `master`,
then spawns a fresh subagent with no parent conversation to run `bun lint` in each
affected package and the locally affected tests, then pushes and watches product CI. Taste observes jobs on every discovered CI host (GitHub Actions, CircleCI,
Buildkite, and similar), not only GitHub checks. Outer loops use the same native hooks
during Taste `PENDING` waits. The loop owns persistence, retry, stop, and escalation.
It does not reinvoke Pick between roasted tasks.

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

## Hosts

| Host | Plugin | Marketplace | Invoke Grow |
| --- | --- | --- | --- |
| Cursor | `terreno-planning` | [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json) | `/terreno-1-grow` |
| Codex | `terreno-planning` | [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json) | `$terreno-1-grow` |
| Claude Code | `terreno` | [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) | `/terreno:1-grow` |

Cursor and Codex also ship outer loops `terreno-planning-loop` and `terreno-taste-sweep`.

Claude Code install:

```text
/plugin marketplace add FlourishHealth/terreno
/plugin install terreno@terreno-plugins
```

Codex install:

```text
codex plugin marketplace add FlourishHealth/terreno
codex plugin install terreno-planning --source terreno-plugins
```

Claude Code's installer collides when the marketplace `name` matches the plugin `name`.
The marketplace is `terreno-plugins`; the plugin stays `terreno` so Grow is `/terreno:1-grow`.

`terreno-planning/` is canonical and keeps the `terreno-<n>-<stage>` skill names used by
Cursor, Codex, and `npx skills`. Codex reads `.codex-plugin/plugin.json` in that same
directory. Claude Code resolves a plugin skill's command from the frontmatter `name`, so
its shortened names cannot live in the shared stage files. `terreno-claude/` is a
**generated** Claude-only copy: same procedure, stage names shortened to `1-grow` …
`5-taste`, published under the plugin name `terreno` so the namespaced command is
`/terreno:1-grow`. Regenerate it with `bun run skills:sync`; never hand-edit it.
