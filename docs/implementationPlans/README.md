# Implementation Plans

Forward-looking design docs for significant features and architectural changes to
Terreno packages, written **before implementation**.

An implementation plan (IP) is one half of a two-file pair:

| File | Holds | Path |
| ---- | ----- | ---- |
| **IP** | Design goals, architecture, models/APIs, testing decisions, phases, acceptance criteria | `docs/implementationPlans/<slug>.md` |
| **Task list** | The bot-consumable execution checklist for that IP | `docs/tasks/<slug>.md` |

The IP is the source of truth for *what and why*; the task list is the source of truth
for *the concrete steps*. External trackers (a GitHub roadmap issue, a Linear issue, a
discussion thread) link **to** these files — they never replace them. See
[`docs/tasks/README.md`](../tasks/README.md) for the task-file shape.

## Status lives on each IP

There is no shared `PLAN_INDEX.md`. That file caused merge conflicts the same way a
shared changelog Unreleased section did. Status is the `**Status:**` line in each
`docs/implementationPlans/<slug>.md` (and in `archive/` after close). List those
directories to see what exists; this README explains the process.

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

The [`terreno-planning` plugin](../../plugins/README.md) drives the pipeline.

**Blend** interviews in grilling rounds (one frontier of decisions per message, recommended
answers, then wait). After the user confirms shared understanding it writes the two files
and ends with a **15-line verify table** — destination, in/out, tracer, task graph, test
seam — so a human can check the plan without rereading the IP.

**Grind** (`terreno-grind`) is the short path for one feature: research, grill, task file
only (`**Grind:** true`), then one fresh TDD sub-agent per task. Escalate to Blend when
the slice is actually an IP (new public API, cross-package, breaking).

1. **Blend** (`terreno-1-blend`) — grill, then write the IP + tracer-bullet task list; end with the 15-line verify table.
2. **Roast** (`terreno-2-roast`) — implement via TDD from the approved IP (or one Grind task).
3. **Cupping** (`terreno-3-cupping`) — independently verify against the IP (skip on Grind unless asked).
4. **Pour** (`terreno-4-pour`) — commit, push, open the PR.
5. **Dial In** (`terreno-5-dialin`) — drive CI and review until mergeable.

**Grind** (`terreno-grind`) replaces steps 1–3 for a single feature: grill, task file only,
one TDD sub-agent per task, then Pour.

You can also author an IP directly with the `ip` skill; both produce the same two files.

### Roadmap handoff (roadmap-enabled repos only)

In repos that run a public roadmap (Discussions + a roadmap Project — currently Terreno),
Blend hands off to `roadmap-item` once the IP is **Approved** to create or update the
public tracking issue, and the IP header records the `Discussion:` and `Roadmap issue:`
links. See [`docs/explanation/roadmap-process.md`](../explanation/roadmap-process.md) for
the full IP ↔ roadmap lifecycle.

In repos with **no** roadmap board (Flourish, most consumer apps), the pipeline is
identical minus that handoff: the IP + task list are the source of truth, and Linear
tracks execution via the IP header `Linear:` link.

## Lifecycle

1. **Draft** → **Approved** — IP written and reviewed (status lives in the IP header).
2. **In progress** → **Complete** — implemented, verified, merged.
3. **Archive** — completed IPs move to `docs/implementationPlans/archive/`.

Plans that are fully implemented and now describe shipped architecture should be migrated
to `docs/explanation/` as reference documentation.
