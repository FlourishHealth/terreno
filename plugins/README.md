# Terreno plugins

Installable Cursor plugins that ship Terreno's agent workflows.

## `terreno-planning` — the planning pipeline

A five-stage agentic SDLC pipeline that takes work from a raw request to a mergeable PR,
plus a **Grind** short path for a single feature. Each skill under
[`terreno-planning/skills/`](terreno-planning/skills) is `disable-model-invocation`, so an
agent runs them only when you invoke them.

| # | Stage (skill) | Does | Reads / writes |
| - | ------------- | ---- | -------------- |
| — | **Grind** (`terreno-grind`) | One feature: research, grill, task list, one TDD sub-agent per task, then Brew | Writes `docs/tasks/<slug>.md` (`**Grind:** true`); no full IP |
| 1 | **Grow** (`terreno-1-grow`) | Grill in rounds, then write the IP + task list; end with a 15-line verify table | Writes `docs/implementationPlans/<slug>.md` + `docs/tasks/<slug>.md` |
| 2 | **Pick** (`terreno-2-pick`) | Implement vertical slices via strict TDD with boundary-only fakes and independent review | Reads the approved IP/tasks |
| 3 | **Roast** (`terreno-3-roast`) | Independently verify against the IP with evidence | Reads the IP; produces evidence |
| 4 | **Brew** (`terreno-4-brew`) | Run all Bun tests quietly, verify docs, spawn standards/spec review, then open/update the draft PR | The PR links its IP |
| 5 | **Taste** (`terreno-5-taste`) | Drive CI and the review loop until mergeable | Post-PR |

The pipeline runs the same way in every Terreno repo. Its permanent artifacts are always
the files Grow (or Grind) writes; external trackers link to them and never replace them. See
[`docs/implementationPlans/README.md`](../docs/implementationPlans/README.md) and
[`docs/tasks/README.md`](../docs/tasks/README.md).

`terreno-code-review` is the read-only review procedure Brew runs in a fresh sub-agent. It
keeps repository-standard findings separate from IP/spec findings.

### Roadmap handoff is conditional

Some repos run a public roadmap (GitHub Discussions + a roadmap Project + tracking issues);
others (Flourish, most consumer apps) do not. The same plugin serves both:

- **Roadmap-enabled repo** (detected by `.github/roadmap-fields.yml` plus a `roadmap-item`
  skill): when an IP reaches **Approved**, Grow hands off to `roadmap-item` to create or
  update the public tracking issue, and the IP header records the `Discussion:` and
  `Roadmap issue:` links. The `roadmap-*` maintainer skills own the public board; see
  [`docs/explanation/roadmap-process.md`](../docs/explanation/roadmap-process.md).
- **No-roadmap repo:** Grow detects the roadmap system is absent and **skips the handoff**.
  The IP + task list are the source of truth (status on each IP's `**Status:**` header),
  and execution is tracked in Linear via the IP header `Linear:` link.

Grow never mutates GitHub itself — it hands off to `roadmap-item`, which stops for
maintainer approval.

The canonical workflow is **Grow → Pick → Roast → Brew → Taste**. The former prose names
Blend, implementation-Roast, Cupping, Pour, and Dial In are deprecated.

## Installing

The plugins are declared in [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json).
Install `terreno-planning` from that marketplace, then invoke a stage by name (for example
`/terreno-1-grow` or `/terreno-grind`).
