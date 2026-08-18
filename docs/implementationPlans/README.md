# Implementation Plans

Forward-looking design docs for significant features and architectural changes to
Terreno packages, written **before implementation**.

An implementation plan (IP) is one half of a two-file pair:

| File | Holds | Path |
| ---- | ----- | ---- |
| **IP** | Design goals, architecture, models/APIs, phases, acceptance criteria | `docs/implementationPlans/<slug>.md` |
| **Task list** | The bot-consumable execution checklist for that IP | `docs/tasks/<slug>.md` |

The IP is the source of truth for *what and why*; the task list is the source of truth
for *the concrete steps*. External trackers (a GitHub roadmap issue, a Linear issue, a
discussion thread) link **to** these files — they never replace them. See
[`docs/tasks/README.md`](../tasks/README.md) for the task-file shape.

## The live index

[`PLAN_INDEX.md`](PLAN_INDEX.md) is the authoritative list of active, completed, and
deferred plans — read it, not this page, to see what is current. This README explains the
process; `PLAN_INDEX.md` tracks the state.

## When to write an IP

Substantial work is planned before coding. Quick rule (full table in
[CONTRIBUTING.md](../../CONTRIBUTING.md#when-to-write-an-implementation-plan-ip)):

| Needs an IP | Does not need an IP |
| ----------- | ------------------- |
| New published package | Bug fix in one package |
| New public API surface | Documentation-only change |
| Cross-package architectural change | Small internal refactor |
| Breaking change | Test or CI fix |

## How a plan gets written and built

The [`terreno-planning` plugin](../../plugins/README.md) drives the pipeline:

1. **Blend** (`terreno-1-blend`) — write the IP + task list, questions first.
2. **Roast** (`terreno-2-roast`) — implement via TDD from the approved IP.
3. **Cupping** (`terreno-3-cupping`) — independently verify against the IP.
4. **Pour** (`terreno-4-pour`) — commit, push, open the PR.
5. **Dial In** (`terreno-5-dialin`) — drive CI and review until mergeable.

You can also author an IP directly with the `ip` skill; both produce the same two files.

### Roadmap handoff (roadmap-enabled repos only)

In repos that run a public roadmap (Discussions + a roadmap Project — currently Terreno),
Blend hands off to `roadmap-item` once the IP is **Approved** to create or update the
public tracking issue, and the IP header records the `Discussion:` and `Roadmap issue:`
links. See [`docs/explanation/roadmap-process.md`](../explanation/roadmap-process.md) for
the full IP ↔ roadmap lifecycle.

In repos with **no** roadmap board (Flourish, most consumer apps), the pipeline is
identical minus that handoff: the IP + task list plus `PLAN_INDEX.md` are the source of
truth, and Linear tracks execution via the IP header `Linear:` link.

## Lifecycle

1. **Draft** → **Approved** — IP written and reviewed (status lives in the IP header and
   `PLAN_INDEX.md`).
2. **In progress** → **Complete** — implemented, verified, merged.
3. **Archive** — completed IPs move to `docs/implementationPlans/archive/` and the index is updated.

Plans that are fully implemented and now describe shipped architecture should be migrated
to `docs/explanation/` as reference documentation.
