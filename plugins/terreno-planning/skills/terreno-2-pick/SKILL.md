---
name: terreno-2-pick
description: Implement one approved IP/task slice with behavior-focused TDD, drift detection, and independent implementation/test-quality review. Not for planning, independent acceptance verification, or PR submission.
disable-model-invocation: true
---

# Pick — build

Implement one approved slice carefully. Pick's internal reviewers ask whether engineering
was disciplined; they do **not** replace Roast's independent proof.

Read the shared [`lifecycle contract`](../../references/lifecycle-contract.md),
[`testing guidance`](references/testing.md), and
[`mocking guidance`](references/mocking.md).

## Preconditions

- An approved IP/task contract exists.
- One current unblocked task/slice is identifiable.
- Branch and prior execution state are available.

## Inputs

- Approved IP, task file, current task, and applicable acceptance criteria
- Branch/current head and execution state
- Selected/discoverable repository skills and instructions
- Prior Pick attempts
- Exact Roast failures or Taste/CI/review evidence when retrying
- Known blockers and existing artifacts

## Procedure

1. **Reconstruct.** Verify the approved plan, current task, branch/head, prior result, and
   already-verified behavior. Do not redo completed work.
2. **Discover supporting skills.** Inspect available project skills for affected domains;
   load applicable implementation, testing, safety, and runtime guidance.
3. **Focus retries.** Convert prior failure evidence into a hypothesis and the smallest
   safe change. Record attempted approaches; do not repeat one without new evidence.
4. **Specify.** State one caller-visible behavior and the highest public seam that proves
   it.
5. **Encode.** Add one failing test and run the repository's closest test command. Confirm
   it fails for the intended product reason.
6. **Fulfill.** Implement the minimum code that passes. Prefer real integrations and
   narrow injected fakes at true external boundaries.
7. **Clean the Kitchen.** Once the vertical slice is green, refactor names/structure,
   remove debug/dead code, and rerun the affected repository-prescribed checks.
8. **Review independently.** In fresh contexts, run:
   - implementation/spec review
   - test-quality review (public behavior, independent expected values, realistic
     boundaries, no leaky/global test doubles)
   Fix material findings and rerun affected checks.
9. **Check drift and runtime.** Compare the diff to the current task/IP. Run any mandatory
   runtime/UI/safety verification declared by repository instructions or supporting
   skills. Missing mandatory capability is `BLOCKED`, not skipped.
10. **Record.** Mark only the completed task/slice, update execution state with commands,
    evidence, artifacts, and attempts, then emit the structured result.

Repeat Specify → Encode → Fulfill for learned behaviors inside this one slice. Do not batch
all tests first or expand into the next task.

## Supporting skills

Follow the shared discovery procedure. Project skills own exact commands, framework
patterns, schema/data rules, test environment, UI verification, prompt governance,
generated-code workflows, and repository gotchas.

## Evidence produced

- Files/behavior completed for the current task
- Red and green test evidence plus required lint/type/build/runtime results
- Internal review results
- Drift decision and artifact references
- Attempted-approach summary (especially on retries)
- Updated execution state and structured Pick result

## Success conditions

- Current task is complete without unresolved internal review findings or plan drift.
- Required repository checks/runtime gates pass for the current head.
- Evidence is sufficient for a fresh Roast verifier.
- Emit `PASS` with `recommended_next_stage: roast`.

## Failure conditions

Tests, internal reviews, or implementation checks that objectively fail emit `FAIL` with
expected/actual/evidence. Recommend `pick` only with a focused next hypothesis; otherwise
escalate under blocked conditions.

## Blocked conditions

An unresolved product/security/data/public-API decision, unsafe destructive change,
missing required verifier, inaccessible dependency, or scope expansion emits `BLOCKED`
with the exact decision/action required.

## Recommended next stage

- `PASS` → Roast
- `FAIL` → Pick with preserved evidence and a new hypothesis
- `BLOCKED` → outer loop routes the named gate
