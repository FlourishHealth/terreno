---
name: terreno-1-grow
description: Research, clarify, shape, and approve an implementation-ready IP and task list. Use for planning substantial work or revising an existing plan; not for implementation or PR operations.
disable-model-invocation: true
---

# Grow — shape

Turn a request, ticket, or specification into approved artifacts a fresh Pick agent can
execute without conversation history.

Read the shared [`lifecycle contract`](../../references/lifecycle-contract.md) and
[`grilling procedure`](references/grilling.md) before acting.

## Preconditions

- A request/spec/ticket and repository are available.
- This invocation owns shaping only; the outer loop owns later stages.

## Inputs

- Request/spec/ticket and linked context
- Existing IP/task files, if revising
- Repository instructions, code, tests, history, and available project skills
- Execution state and prior result, when present

## Procedure

1. **Reconstruct.** Resolve the repository's existing IP/task conventions from its
   instructions and nearby artifacts. If none exists, choose a colocated IP/task pair,
   record the new convention, and avoid creating a shared mutable index. Read prior state
   and verify it against repository reality.
2. **Discover supporting skills.** Inspect available repository/project skills and load
   those relevant to the affected domains. Record selected skills for downstream stages.
3. **Research before asking.** Classify uncertainty:
   - **Human decision:** product, architecture, security, data ownership, compatibility,
     rollout, destructive change, or scope → grill and block until answered.
   - **Discoverable fact:** repository convention, library behavior, ownership, tests →
     investigate it.
   - **Low-risk implementation detail:** strongly implied by convention → choose it and
     record the assumption.
4. **Grill.** Work the current decision frontier in numbered rounds with recommended
   answers. Wait for explicit shared-understanding confirmation before writing.
5. **Shape.** Prefer contracts/models/APIs before implementation detail where applicable.
   Define scope, non-scope, architecture decisions, risks, human gates, rollout, and
   dependencies.
6. **Specify proof.** Make every acceptance criterion observable and pair it with a
   verification method (test, build, runtime/API/database probe, UI exercise, artifact,
   compatibility/regression case).
7. **Write.** Produce the IP and a dependency-aware tracer-bullet task list. Each task
   names files/seams, acceptance criteria, blockers, verification, and relevant supporting
   skills when discoverable.
8. **Approve.** Show the 15-line approval summary defined in the grilling reference. Set
   the repository's approved status only after human confirmation. Update execution state
   and emit the stage result.

## Supporting skills

Follow the shared discovery procedure. Supporting skills may cover API/UI architecture,
data access, schemas, prompts, deployment, testing, or safety. Names are repository-defined;
none is universally required.

## Evidence produced

- Approved IP path and task-file path
- Research findings and recorded assumptions (not chain-of-thought)
- Decision log/human gates
- Acceptance-criterion → verification mapping
- Selected supporting skills
- Updated execution state and structured Grow result

## Success conditions

- IP/task artifacts are approved, implementation-ready, dependency-aware, and testable.
- A fresh Pick invocation can identify the next unblocked task, applicable criteria,
  decisions, supporting skills, and risks from durable artifacts.
- Emit `PASS` with `recommended_next_stage: pick`.

## Failure conditions

Malformed or contradictory artifacts emit `FAIL` with exact defects,
`recommended_next_stage: grow`, and a focused Grow retry. Do not pass incomplete criteria
to Pick.

## Blocked conditions

Unresolved human decisions, unavailable required evidence/access, or unsafe ambiguity emit
`BLOCKED` with `recommended_next_stage: null`, options, tradeoffs, and a recommended
default when appropriate.

## Recommended next stage

- `PASS` → Pick
- `FAIL` → Grow with defect evidence
- `BLOCKED` → outer loop routes the named human/external gate
