# Loop engineering

This file describes orchestration for a runner, human, or automation. The lifecycle
skills do not implement this loop.

```text
Grow PASS → Pick PASS → Roast PASS → Brew PASS → Taste
                       ↘ Roast FAIL → Pick (with failure evidence)
Taste PENDING ─────────→ outer loop waits → fresh Taste
Taste PASS ────────────→ merge-ready
Any BLOCKED ───────────→ human/external gate
```

The loop persists the execution state, starts fresh agents with only the required
artifacts, honors `recommended_next_stage`, waits on `PENDING`, and stops on `PASS` or
`BLOCKED` according to policy. It must not turn a human decision into retries.

## Invocation packet

Give each fresh agent:

1. lifecycle skill path/name
2. IP and task path
3. execution-state artifact
4. branch and current PR (if any)
5. previous stage result and referenced evidence
6. pointer to repository architecture docs for the affected area

The stage discovers repository skills itself. The loop may suggest known skills but must
not replace stage-level discovery.

## Feature profile (formerly Grind)

For one bounded feature, the loop may use a compact approved task file instead of a full
IP when repository policy permits:

1. Invoke Grow to research/grill and write the compact task contract.
2. Invoke a fresh Pick agent for each unblocked task; run independent tasks in parallel.
3. Invoke Roast on the integrated result unless repository policy explicitly permits the
   lightweight path to skip independent verification.
4. Invoke Brew, then fresh Taste iterations.

One task per Pick invocation keeps context bounded. The loop, not a long-lived parent
agent, marks tasks, persists results, and dispatches the next frontier.

## Backend/API scenario

- Grow shapes the model/API contract, acceptance criteria, and discoverable supporting
  skills.
- Pick loads applicable API, schema, and test-environment skills and implements with TDD.
- Roast independently exercises routes, integration/database behavior, and regressions.
- Brew submits the verified head.
- Taste reacts once per current CI/review state until the loop receives `PASS`.

## UI scenario

- Grow shapes UX, API, state, and observable verification criteria.
- Pick loads applicable UI conventions and implements/tests the behavior.
- Roast loads the repository's UI verification capability, launches the real app,
  exercises the changed workflow, and records media evidence.
- Brew attaches evidence.
- A Taste fix that changes UI reruns the required UI verification, pushes, and returns
  `PENDING` for the new head.

## CI/review scenario

1. Taste sees a branch-caused CI failure on SHA A, fixes and verifies it, pushes SHA B,
   emits `PENDING`, and exits.
2. The outer loop waits and invokes fresh Taste. It sees green CI plus an actionable
   review comment, fixes it, pushes SHA C, emits `PENDING`, and exits.
3. The outer loop waits and invokes fresh Taste. It sees all checks terminal/pass, no
   conflicts, and no actionable comments, then emits `PASS`.

