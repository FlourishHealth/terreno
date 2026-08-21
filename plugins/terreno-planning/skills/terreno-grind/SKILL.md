---
name: terreno-grind
description: Quick single-feature pipeline — research, grill, task list, then one TDD sub-agent per task. Use for an individual feature or bugfix that does not need a full Grow IP. Use when the user says grind, espresso, quick feature, or implement this slice with sub-agents. Do not use for large cross-package IPs (Grow) or for PR/CI operations alone (Brew / Taste).
disable-model-invocation: true
---

# Grind

Fast path for **one feature**. Parent agent plans and dispatches. Sub-agents implement.
That split fights context creep.

Full Grow → Pick → Roast → Brew → Taste still exists for large IPs. Grind is the
short loop: research → grill → tasks → parallel-enough TDD agents → Brew.

## When to use

Use Grind when the work is one vertical slice in a known area (one model, one screen,
one hook, one bug).

Use **Grow** instead when any of these are true:

- New public API or published package
- Cross-package architecture
- Breaking change
- The user asked for a durable IP

If Grind grilling reveals the work is an IP, stop and hand off to Grow. Do not keep a
shadow plan in chat.

## Parent agent responsibilities

The parent **does not implement production code**. It:

1. Researches
2. Grills
3. Writes the task file
4. Spawns one fresh sub-agent per frontier task
5. Integrates (conflicts, leftover wiring)
6. Hands off to Brew when the task list is complete

Load Grow grilling: [`../terreno-1-grow/references/grilling.md`](../terreno-1-grow/references/grilling.md).
Load Pick TDD: [`../terreno-2-pick/references/testing.md`](../terreno-2-pick/references/testing.md)
and [`../terreno-2-pick/references/mocking.md`](../terreno-2-pick/references/mocking.md).

## 1. Research (facts)

Spawn explore sub-agents in parallel. Typical bundle:

- Where the feature lives (files, tests, public seam)
- Closest existing pattern (copy this, do not invent a third style)
- Test conventions in that package (`assert` vs `expect`, fixtures, fakes)

Do not ask the user these. Bring findings into the first grill round as context.

## 2. Grill (decisions)

Short tree:

1. Destination (one sentence)
2. In / out
3. Tracer seam
4. Test double style at the boundary
5. Anything product-shaped (copy, permissions, empty states)

Whole frontier, numbered, recommended answers, then **wait**. Confirm-and-write when
empty. Same message shape as Grow grilling.

Cap at two rounds when possible. If round two still has architecture forks, escalate to
Grow.

## 3. Task list

Write `docs/tasks/<slug>.md` (create `docs/tasks/` if needed).

For Grind, the spec lives **in the task file header** so Pick sub-agents do not need a
full IP:

```markdown
# <Feature>

**Status:** Approved
**Created:** YYYY-MM-DD
**Grind:** true
**Destination:** <one sentence>
**Out of scope:** <one line>
**Tracer:** <seam>
**Tests:** <file> — <fake or fixture>

## Tasks

- [ ] T1: <tracer — failing test then impl>
- [ ] T2: <next slice>
  - Blocked by: T1
```

Rules:

- Tracer is T1. It is a complete thin slice through the public seam, tests first.
- Every later task has `Blocked by:` until its parent is done.
- Each task must be finishable by a **fresh** sub-agent that has never seen the parent
  chat. Put file paths, function names, and the exact failing assertion in the task body.
- Prefer 3–6 tasks. If you need more than 8, this is a Grow IP.

Also send the Grow **plan summary table** (15-line cap) with `IP: none (Grind)` and
wait for the user to confirm before spawning implementers.

## 4. Dispatch — one sub-agent per task

Only spawn tasks whose `Blocked by` parents are checked off.

For each frontier task, spawn a **new** sub-agent (`generalPurpose`, fresh context).
Do not reuse a sub-agent across tasks. Do not implement in the parent.

### Sub-agent prompt (required shape)

Tell the sub-agent:

- Read `docs/tasks/<slug>.md` and implement **only** `<task id>`
- Follow `plugins/terreno-planning/skills/terreno-2-pick/SKILL.md` Pick TDD:
  Specify → Encode → Fulfill (red, then green)
- Read Pick `references/testing.md` and `references/mocking.md`
- Inject typed fakes at boundaries. Do not use `mock.module` unless the task says why
- Run that package with `bun run test:agent` (or the file path) until green
- Do not expand scope. Do not start the next task. Do not open a PR
- Commit with `git commit -s` if the parent asked for commits; otherwise leave the diff
- Return: files changed, test command + result, anything blocked

Spawn independent frontier tasks in parallel. Serialise only when `Blocked by` requires
it.

### After each sub-agent returns

1. Mark the task done in `docs/tasks/<slug>.md`
2. Skim the diff for scope creep (files outside the task). If found, revert or split
3. Unlock children and spawn the next wave
4. If the sub-agent failed, fix the task description (missing path, wrong seam) and
   respawn — do not take over implementation in the parent unless the fix is a one-line
   glue change

## 5. Integrate and Brew

When all tasks are checked:

1. Parent: resolve leftover imports/types only
2. Run `bun run test:agent` (and `bun run lint` if JS/TS changed)
3. Tell the user to invoke **Brew** (`terreno-4-brew`) for docs, code review, and the
   draft PR. Grind does not open PRs.

Skip independent Roast verification unless the user asks. Brew always hands the open PR
to Taste. Skip roadmap-item.

## Anti-patterns

- Parent writes the feature "to save a spawn"
- One sub-agent given the whole task list
- Tasks without file paths (forces the child to re-research)
- Grilling skipped because "it's small"
- Full IP written in Grind (that's Grow)
- `mock.module` in a shared test file
