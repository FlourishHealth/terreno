---
name: 3-roast
description: Independently prove or disprove that the current implementation satisfies its approved IP and acceptance criteria. Use after Pick, preferably in a fresh context; not for fixing implementation code.
disable-model-invocation: true
---

# Roast — prove

Roast is the authoritative stage-level verifier:

```text
requirement → verification method → evidence → PASS / FAIL / BLOCKED
```

Read the shared [`lifecycle contract`](../../references/lifecycle-contract.md) and
[`documentation contract`](../../references/documentation-contract.md).

## Preconditions

- An approved IP/task contract and completed Pick result exist.
- Current branch/head and diff are resolvable.
- Run in a fresh context when the harness permits.

## Inputs

- IP, task file, acceptance criteria, and verification requirements
- Current branch/head, diff, and PR when present
- Pick result, execution state, prior Roast attempts, and artifacts
- Repository instructions and available project/verification skills

## Procedure

1. **Reconstruct independently.** Verify the head and source artifacts. Do not trust
   Pick's completion claims as proof.
2. **Discover supporting skills.** Load applicable domain and verification skills.
   Repository-mandatory capabilities are hard requirements.
3. **Build the matrix.** Map every in-scope criterion to one or more objective methods and
   the evidence required. Include promised regressions, compatibility, and non-scope.
4. **Inspect and execute.** Review the diff and run concrete checks independently:
   repository-prescribed tests, integration/system behavior, lint/type/build checks,
   runtime/API/database probes, regression reproductions, or real UI interaction.
5. **Exercise changed behavior.** For UI-facing work, use the available repository UI
   verification capability, interact with the actual changed workflow, and capture
   required screenshots/video/logs. App launch alone is not proof.
6. **Prove docs.** Confirm architecture and public docs match the shipped behavior. A
   criterion that is true in code but absent or wrong in docs is `FAIL`.
7. **Classify each criterion.** Record `PASS`, `FAIL`, or `BLOCKED` with reproducible
   evidence. Never pass a criterion because the code merely looks reasonable.
8. **Do not fix.** Report implementation defects to Pick. Only correct verifier setup
   owned by Roast; if that changes evidence materially, rerun the affected method.
9. **Record.** Update execution state and emit the structured result collapsed per the
   lifecycle contract.

## Supporting skills

Follow the shared discovery procedure. Applicable skills may supply API/database test
methods, UI/runtime verification, security/safety checks, build commands, or deployment
probes. If repository policy makes one mandatory and it is unavailable, emit `BLOCKED`.

## Evidence produced

- Requirement-to-evidence matrix
- Commands/probes/interactions and outcomes
- Artifact/log/API response references
- Exact expected vs actual behavior for every failure
- Environment/access details for every blocker
- Docs pages that match or fail against shipped behavior
- Updated execution state and structured Roast result

## Success conditions

- Every in-scope acceptance criterion has objective passing evidence on the recorded head.
- Required regression/runtime/UI checks pass.
- Architecture and public docs match the shipped behavior.
- Emit `PASS` with `next: brew`.

## Failure conditions

One or more criteria disproven by evidence emits `FAIL` with severity, expected, actual,
and reproducible evidence. Set `next: pick`.

## Blocked conditions

Unavailable required environment/capability/access, ambiguous criterion requiring a human
decision, or external service failure that prevents proof emits `BLOCKED` with exact
classification, `next: null`, and next action.

## Recommended next stage

- `PASS` → Brew
- `FAIL` → Pick with exact failure evidence and current head
- `BLOCKED` → outer loop classifies retryable environment/external vs human gate
