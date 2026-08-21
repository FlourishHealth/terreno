---
name: terreno-1-blend
description: Interview the user in grilling rounds, then write or update the IP and task list. Use when planning work, drafting or revising an implementation plan, changing IP status, or the user says blend / plan this / write an IP. Do not use for implementing code, submitting PRs, or monitoring CI.
disable-model-invocation: true
---

# Blend

Turn a request into an implementation plan and a bot-consumable task list. Interview
first. Write after the user confirms shared understanding.

Load [`references/grilling.md`](references/grilling.md) before asking questions.

## Preconditions

This is planning, not implementation and not PR operations.

## Output contract

Every plan is two files. External trackers link here; they never replace these files.

| File | Path | Holds |
| ---- | ---- | ----- |
| IP | `docs/implementationPlans/<slug>.md` | Goals, architecture, models/APIs, testing decisions, phases, acceptance |
| Tasks | `docs/tasks/<slug>.md` | Execution checklist Roast consumes |

Follow [`docs/implementationPlans/README.md`](../../../../docs/implementationPlans/README.md)
and [`docs/tasks/README.md`](../../../../docs/tasks/README.md).

For a **single-feature** slice that does not need a full IP, stop and tell the user to
invoke **Grind** (`terreno-grind`) instead. Blend is for work that needs a durable design
doc. If unsure, grill "IP vs Grind" as Q1.

## Grilling (required before any new or materially revised plan)

Do not emit a blocking-questions wall. Run the round loop in `references/grilling.md`.

Minimum tree for a Terreno plan:

1. Destination (what exists when done)
2. In / out of scope
3. Public seam for the tracer bullet (route, model, hook, CLI, screen)
4. Packages touched
5. Test seam and double style (see Roast `references/mocking.md` — inject at boundaries)
6. Auth, permissions, sync vs OpenAPI, if relevant
7. Rollout / flags / breaking changes, if relevant
8. Tracker (Linear / none). Never invent a Linear issue.

Facts: spawn explore sub-agents. Decisions: ask the user, whole frontier, one round,
recommended answers, then wait.

## After confirmation — write the files

Write or update the IP, then the task list, in the same turn. Do not implement.

### IP must include

- Header: `**Status:**`, `**Created:**`, `**Author:**` (`agent (<model>)`), optional
  `**Linear:**` / `**Discussion:**` / `**Roadmap issue:**`
- Architecture and models/APIs
- **Testing decisions:** public seam, fixture vs injected fake, isolation if `mock.module`
- Phases and acceptance criteria
- Task list as a bullet outline plus pointer to `docs/tasks/<slug>.md`

### Task list must include

- Tracer-bullet tasks (narrow, independently shippable, tests first)
- `Blocked by:` on every task that is not a frontier item
- Checkboxes Roast can mark

Do not write a task that depends on an unwritten earlier task without `Blocked by:`.

## Plan summary (required, last message after writing)

The user verifies from this block alone. Keep it **short**. No recap of the interview.
No restating the full IP.

```markdown
**Plan:** `docs/implementationPlans/<slug>.md`
**Tasks:** `docs/tasks/<slug>.md`

| | |
| --- | --- |
| Destination | <one sentence> |
| In | <tags or 3–6 words> |
| Out | <tags or 3–6 words> |
| Tracer | <seam> |
| Tasks | <N> (frontier: <ids>; blocked: <ids>) |
| Tests | <file or seam → fake/fixture> |

Decisions: <Q#=choice, Q#=choice>
Confirm by reading the table. Next: invoke Roast on the frontier tasks.
```

Hard cap: **15 lines**. If a cell needs a paragraph, the IP is the paragraph; the table
stays terse.

## Lifecycle (existing plans)

When the user asks to create, update, approve, complete, defer, or kill a plan:

- **New / revise:** grill, confirm, write, summary table.
- **Approve:** set `**Status:** Approved`. If `.github/roadmap-fields.yml` and a
  `roadmap-item` skill exist, stop and tell the user to invoke `roadmap-item` with the IP
  path. Do not create GitHub issues from Blend. If those files are absent, skip.
- **Complete / kill:** move IP to `docs/implementationPlans/archive/` and tasks to
  `docs/tasks/archive/` (create `archive/` if needed).
- **Defer:** leave files; set `**Status:** Deferred`.

Always update `**Status:**` on the IP. There is no `PLAN_INDEX.md`.

## Execution rules

- Do not write application code.
- Do not open, update, or merge a PR.
- Do not monitor CI or review comments.
- Do not start Roast until the user confirms the summary table.
- Prefer editing an existing IP over creating a duplicate.
- Ask before overwriting an IP that is Approved or In Progress.
