---
name: terreno-planning-loop
description: Outer loop over the approved task list. Default Grow once, then Pick and Roast each remaining task. Pass phases to restrict (grow, pick, roast, brew, taste). Not a lifecycle stage.
disable-model-invocation: true
---

# Planning loop — walk the task list

Invoke sibling lifecycle stages against every remaining task. Stages stay bounded; this
skill **is** the outer loop. It persists execution state, honors `next`, waits on
`PENDING`, and stops on `BLOCKED`.

Read the shared [`lifecycle contract`](references/lifecycle-contract.md),
[`documentation contract`](references/documentation-contract.md),
[`loop engineering`](references/loop-engineering.md), and Grow's
[`grilling procedure`](../terreno-1-grow/references/grilling.md) when Grow is in scope.

Sibling stages:

- [`terreno-1-grow`](../terreno-1-grow/SKILL.md)
- [`terreno-2-pick`](../terreno-2-pick/SKILL.md)
- [`terreno-3-roast`](../terreno-3-roast/SKILL.md)
- [`terreno-4-brew`](../terreno-4-brew/SKILL.md)
- [`terreno-5-taste`](../terreno-5-taste/SKILL.md)

Never reimplement a stage. Read the sibling skill and follow it for that invocation.

## Preconditions

- A request, IP, or task file is resolvable, or Grow is in the selected phases so it can
  create them.
- Sibling stage skills from this plugin are available.

## Inputs

- Request/spec/ticket, existing IP/task files, execution state
- Optional **phases** from the invocation text

Parse phases from the user message after the skill name. Accept comma or space
separation, with or without a `phases=` prefix. Allowed names: `grow`, `pick`, `roast`,
`brew`, `taste`. Unknown names are `BLOCKED`.

Examples:

- `/terreno-planning-loop` → `grow,pick,roast`
- `/terreno-planning-loop grow,roast` → Grow once, then Roast each task (no Pick)
- `/terreno-planning-loop phases=roast` → Roast every in-scope task
- `/terreno-planning-loop pick` → Pick remaining unblocked tasks only
- `/terreno-planning-loop grow,pick,roast,brew,taste` → full lifecycle through submit

Default when the user names no phases: `grow`, `pick`, `roast`.

## Procedure

1. **Resolve artifacts.** Reconstruct the repository's IP/task convention. If none exists
   and `grow` is selected, Grow will create it. If none exists and `grow` is not selected,
   emit `BLOCKED` (missing plan). Read execution state and verify branch/sha/PR.
2. **Grow once (if selected).** Invoke `terreno-1-grow` for the whole IP and task list.
   Wait for human grilling/approval per Grow. `PASS` continues. `FAIL` retry Grow with
   defect evidence. `BLOCKED` stop. Do not Grow per task.
3. **Order the task list.** Use the approved tracer-bullet order. Skip tasks that are
   already complete for every selected per-task stage. Skip tasks whose blockers are
   unmet. A roast-only run still walks tasks whose Pick claims complete; Roast reconstructs
   independently and must not trust those claims.
4. **Alternate per-task stages.** For each remaining task, run selected **per-task**
   stages in this order: Pick, then Roast.

   - **Pick** (if selected): invoke `terreno-2-pick` for that one task. `PASS` continues
     to Roast when Roast is selected, else mark the task picked and move on. `FAIL` retry
     Pick with the new evidence. `BLOCKED` stop the loop. Three consecutive Picks on the
     same head SHA with the same `status` and no new evidence → `blocked-stuck`.
   - **Roast** (if selected): invoke `terreno-3-roast` for that task's criteria (or the
     integrated slice when the task file says so). `PASS` marks the task proven. `FAIL`
     with Pick in phases → Pick again with Roast evidence, then Roast again. `FAIL`
     without Pick → stop; this loop does not fix implementation itself. `BLOCKED` stop.
5. **Brew once (if selected)** after every in-scope task has passed the selected per-task
   stages. Invoke `terreno-4-brew`. Honor `status` and `next`:

   - `PASS` → continue to Taste when Taste is selected; otherwise the loop `PASS`es with
     `next: taste`.
   - `PENDING` → wait `wait` seconds if present, otherwise 120 seconds, then invoke Taste
     when selected; Brew itself does not retry product CI.
   - `FAIL` → invoke the stage Brew named (`pick`, `roast`, or `brew`) when that stage is
     in the selected phases (or `brew` even if it was the current stage). After Pick or
     Roast recovers, invoke Brew again. Three consecutive Brew `FAIL`s on the same head
     SHA with the same `next` and no new evidence → `blocked-stuck`. If Brew names a
     stage that is not in phases, stop and report that `next` for the caller.
   - `BLOCKED` → stop.
6. **Taste until terminal (if selected).** Same outer-loop rules as
   [`terreno-taste-sweep`](../terreno-taste-sweep/SKILL.md) workers: invoke
   `terreno-5-taste` until `PASS` or `BLOCKED`; wait on `PENDING`; retry `FAIL`; stop as
   `blocked-stuck` after three identical head+status results.
7. **Report.** Lead with `status`, `next`, and `action`. Table:

   | Task | Stages run | Outcome | Notes |
   | --- | --- | --- | --- |

   Then the collapsed stage-result YAML from the last invocation, per the lifecycle
   contract. Persist execution state between stage invocations.

## Supporting skills

This loop loads only the selected sibling stages plus skills those stages discover.
It does not add repository-specific commands of its own.

## Evidence produced

- Selected phases
- Per-task stage outcomes and last `action`/`block`
- Execution-state path and current head
- Final loop `status` / `next` / `action`

## Success conditions

- Every in-scope task passed every selected per-task stage.
- Grow/Brew/Taste succeeded when selected.
- Emit `PASS` with `next: brew` when the run stopped after Roast, `next: taste` after
  Brew, `next: null` after Taste `PASS`, or `next: pick`/`roast` when those remain.

## Failure conditions

A selected stage returns `FAIL` and retries are exhausted (`blocked-stuck`), Pick is
not in phases so Roast `FAIL` cannot be repaired here, or Brew `FAIL` names a stage
that is not in the selected phases.

## Blocked conditions

- Unknown phase name
- Missing IP/tasks when `grow` is not selected
- Any stage `BLOCKED` (human/environment/access/external)
- Missing sibling stage skill

## Recommended next stage

- Default run `PASS` → Brew (unless Brew already ran)
- `phases=grow,roast` `PASS` → Pick if implementation remains, else Brew
- Roast `FAIL` with Pick in phases → Pick
- Brew `FAIL` → stage Brew named (`pick`, `roast`, or `brew`)
- Any `BLOCKED` → `next: null` plus the named gate
