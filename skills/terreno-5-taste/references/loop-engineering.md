# Loop engineering

This file describes orchestration for a runner, human, or automation. The lifecycle
skills do not implement this loop.

```text
Grow PASS → Pick PASS → Roast PASS → Brew PASS → Taste
                       ↘ Roast FAIL → Pick (with failure evidence)
Taste PENDING (product CI / bot timeout) ───→ outer loop waits → fresh Taste
Taste waits in-process for Bugbot/CodeQL ───→ same invocation reacts
Taste PASS ────────────→ merge-ready
Any BLOCKED ───────────→ human/external gate
```

The loop persists the execution state, starts fresh agents with only the required
artifacts, honors `next`, waits on `PENDING` (`wait` seconds), and stops on `PASS` or
`BLOCKED` according to policy. It must not turn a human decision into retries. Stage
YAML is loop/skill data; keep it collapsed for humans. Brew and Taste themselves sleep
until async review bots on the current head have reported; the loop does not need to
reinvoke for that wait.

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
- Taste reacts to the current CI/review state until the loop receives `PASS`. Before
  exiting, it sleeps until Bugbot, CodeQL, and similar review bots on this head have
  reported, then acts on those results.

## UI scenario

- Grow shapes UX, API, state, and observable verification criteria.
- Pick loads applicable UI conventions and implements/tests the behavior.
- Roast loads the repository's UI verification capability, launches the real app,
  exercises the changed workflow, and records media evidence.
- Brew attaches evidence.
- A Taste fix that changes UI reruns the required UI verification, pushes, and returns
  `PENDING` for the new head.

## CI/review scenario

1. Brew pushes the PR, sleeps until Bugbot/CodeQL (if running) are terminal, records
   outcomes, and exits with `next: taste` without implementing fixes.
2. Taste waits if those bots are still running, then sees a branch-caused CI failure on
   SHA A, fixes and verifies it, pushes SHA B, waits again for review bots on B, and
   acts once on those results. A further push emits `PENDING` and exits.
3. The outer loop waits (product CI or bot timeout) and invokes fresh Taste. It sees
   green checks plus an actionable human review comment, fixes it, waits for review
   bots on the new head, and emits `PENDING` or `PASS`.
4. When all checks are terminal/pass, no conflicts, and no actionable comments remain,
   Taste emits `PASS`.

