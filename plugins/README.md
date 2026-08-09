# Terreno plugins

Installable Cursor plugins that ship Terreno's agent workflows.

## `terreno-planning` — the planning pipeline

A five-stage agentic SDLC pipeline that takes work from a raw request to a mergeable PR.
Each stage is a skill under [`terreno-planning/skills/`](terreno-planning/skills); all are
`disable-model-invocation`, so an agent runs them only when you invoke them.

| # | Stage (skill) | Does | Reads / writes |
| - | ------------- | ---- | -------------- |
| 1 | **Blend** (`terreno-1-blend`) | Plan — questions first, then write the IP + task list | Writes `docs/implementationPlans/<slug>.md` + `docs/tasks/<slug>.md` |
| 2 | **Roast** (`terreno-2-roast`) | Implement via strict TDD with drift detection and independent review | Reads the approved IP/tasks |
| 3 | **Cupping** (`terreno-3-cupping`) | Independently verify against the IP with evidence | Reads the IP; produces evidence |
| 4 | **Pour** (`terreno-4-pour`) | Commit, push, open/update the draft PR with evidence | The PR links its IP |
| 5 | **Dial In** (`terreno-5-dialin`) | Drive CI and the review loop until mergeable | Post-PR |

The pipeline runs the same way in every Terreno repo. Its permanent artifacts are always
the two files Blend writes; external trackers link to them and never replace them. See
[`docs/implementationPlans/README.md`](../docs/implementationPlans/README.md) and
[`docs/tasks/README.md`](../docs/tasks/README.md).

### Roadmap handoff is conditional

Some repos run a public roadmap (GitHub Discussions + a roadmap Project + tracking issues);
others (Flourish, most consumer apps) do not. The same plugin serves both:

- **Roadmap-enabled repo** (detected by `.github/roadmap-fields.yml` plus a `roadmap-item`
  skill): when an IP reaches **Approved**, Blend hands off to `roadmap-item` to create or
  update the public tracking issue, and the IP header records the `Discussion:` and
  `Roadmap issue:` links. The `roadmap-*` maintainer skills own the public board; see
  [`docs/explanation/roadmap-process.md`](../docs/explanation/roadmap-process.md).
- **No-roadmap repo:** Blend detects the roadmap system is absent and **skips the handoff**.
  The IP + task list plus `PLAN_INDEX.md` are the source of truth, and execution is tracked
  in Linear via the IP header `Linear:` link.

Blend never mutates GitHub itself — it hands off to `roadmap-item`, which stops for
maintainer approval.

> **Planned rename:** the stages are being renamed to **grow → harvest → roast → brew →
> taste** with aliases for the current names; see
> [`docs/implementationPlans/agentic-sdlc-plugin.md`](../docs/implementationPlans/agentic-sdlc-plugin.md).
> Until that ships, the stage names above are current.

## Installing

The plugins are declared in [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json).
Install `terreno-planning` from that marketplace, then invoke a stage by name (for example
`/terreno-1-blend`).
