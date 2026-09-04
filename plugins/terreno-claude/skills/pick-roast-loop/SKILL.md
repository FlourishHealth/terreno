---
name: pick-roast-loop
description: Drive an approved plan through every Pick–Roast cycle until all tasks pass or a genuine human decision is required. Continue through recoverable engineering failures, keep a complete run ledger, and when input is required present the overall state, completed work and evidence, options, recommendation, and exact question. Not for Grow, Brew, Taste, or CI monitoring.
---

# Pick–Roast loop (outer recovery driver)

Drive an **approved** task list through implementation and independent proof. This is
an outer recovery loop around Pick's inner loop: normally invoke Pick once and let it
continue task by task; reinvoke only when Pick or Roast had to exit with actionable
engineering work remaining.

Read the shared [`lifecycle contract`](../../references/lifecycle-contract.md),
[`pick-roast inner loop`](../../references/pick-roast-loop.md), and
[`subagent briefing`](../../references/subagent-briefing.md). The ledger must conform
to [`execution-state.schema.json`](../../references/execution-state.schema.json).

## Scope

- Included: Pick, each task's Roast, focused retries, execution-state persistence, and
  one accumulated report.
- Excluded: Grow/plan approval, Brew/PR submission, Taste/CI/review monitoring, release,
  deployment, and unrelated cleanup.
- Never invoke Brew or Taste. Successful completion emits `next: brew`.

## Preconditions

- A human-approved IP/task contract exists.
- The current branch, task list, and execution-state location are resolvable.
- At least one task is incomplete or has a non-terminal Roast result.

If the plan is missing or unapproved, stop at a human gate. Do not silently run Grow or
invent acceptance criteria.

## Run ledger

Create one compact `ledger` array in execution state before invoking a stage. Append one
schema-valid entry after every Pick/Roast result:

- task id and short outcome
- attempt number and head SHA
- files changed
- Roast verdict and criterion failures
- focused fix/hypothesis used for each retry
- checks, artifacts, and docs evidence
- blockers, decisions, and residual risks

Do not stream a recap after each cycle. Preserve stage evidence, but defer the
human-facing report until completion or a genuine human gate.

## Drive

1. **Reconstruct once.** Read the approved task graph and execution state. Identify the
   next incomplete or failed task. Verify branch/head and prior attempts.
2. **Invoke the named stage.** After reconstructing, invoke `next.stage` when it is set;
   otherwise default to Pick. Use Pick for implementation/rework, or Roast when Pick
   completed the task but exited before proof. Pass the current task, exact prior
   evidence, and the same task-scoped briefing. Pick owns normal task → Roast →
   next-task progression.
3. **Consume the result.** Update the ledger, then classify:
   - `PASS` with all tasks Roast-passed → finish with `next: brew`.
   - `FAIL` with `next: pick` or `next: roast` and a concrete engineering action →
     reinvoke that stage in a fresh context with prior evidence and the same
     task-scoped briefing.
   - `BLOCKED` with a `block` entry whose `kind` is `human`, or `next.human: true` →
     present the human gate.
   - `BLOCKED` for environment/access/external state → attempt safe autonomous
     remediation or a bounded retry when a new hypothesis exists. Never relabel it
     `human` merely to stop.
   - A terminal non-human blocker with no safe remediation → stop and report it as
     blocked; do not ask the human a decision question unless they can actually decide it.
4. **Bound retries by evidence.** A retry must add a new hypothesis, changed setup, or
   new evidence. Never repeat the same failed command/approach. After two focused
   failures for the same task and stage with no new hypothesis, classify the underlying
   decision or capability honestly instead of looping.
5. **Continue silently.** Repeat steps 2–4, invoking only the stage named by durable
   state and passing the same task-scoped briefing every time, until every task passes
   Roast or a stop condition below is reached.

## Genuine human gate

Ask for input only for:

- unresolved product semantics or acceptance criteria
- architecture, security, privacy, data ownership, or public compatibility choices
- destructive/irreversible operations or policy-required approval
- material scope expansion with multiple valid outcomes
- credentials/permissions the human can provide and no authorized alternative exists

Before the question, provide this overview in plain language:

1. **Goal and state:** plan name, current task, completed/total tasks, current head.
2. **What happened:** work completed, Roast results, retries, and decisive evidence.
3. **Why input is needed:** the exact decision and why engineering evidence cannot
   choose it.
4. **Options:** two to four concrete choices with impact and risk.
5. **Recommendation:** one default and its rationale.

End with **one exact question** the human can answer in one message. Do not expose
chain-of-thought, raw transcripts, or unexplained stage YAML.

## Completion report

When all tasks Roast-pass, lead with:

`PASS — <passed>/<total> tasks independently verified. Next: Brew.`

Then report:

- `Completed`: every task and shipped behavior
- `Roast history`: failures found and how each was resolved
- `Verification`: checks, runtime evidence, artifacts, and docs
- `Changes`: commits/head and important files
- `Residual risk`: explicit remaining risk or `None identified`
- `Next`: `4-brew`

When stopped, use the same report plus `Blocker`. Include everything from the ledger
once; do not duplicate per-cycle narration.

## Stop conditions

- `PASS`: every in-scope task has Roast `PASS` on the recorded head.
- `BLOCKED` (human): a genuine human gate above.
- `BLOCKED` (non-human): retries are exhausted and no safe autonomous action exists.
- `FAIL`: state is inconsistent/corrupt or the named next stage cannot be invoked.

Ordinary test failures, lint failures, implementation defects, and Roast findings are
not terminal while a concrete engineering action remains.

## Emit

After the human-facing report, include one collapsed stage-result payload. Since outer
loops are not stages, set `stage` to the last stage invoked (`pick` or `roast`).

```yaml
v: 2
stage: pick
status: PASS
next: brew
action: Submit the fully Roast-verified plan with Brew.
```

For a human gate, use `status: BLOCKED`, `next: null`, and an `ask` entry containing
the exact question, recommendation, and options. For a non-human terminal blocker, use
a `block` array entry with `kind: environment`, `access`, or `external`, and omit `ask`.
