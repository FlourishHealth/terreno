# Loop engineering

This file describes orchestration for a runner, human, or automation. The lifecycle
skills do not implement Grow → Brew → Taste. Pick and Roast **do** implement the
[`pick-roast inner loop`](pick-roast-loop.md) in-process.

```text
Grow PASS → Pick/Roast inner loop → Brew PASS → Taste
              Pick one task → Roast that task
              Roast FAIL → Pick (same task, exact evidence)
              Roast PASS + remaining tasks → Pick (next frontier task)
              Roast PASS + no remaining tasks → Brew
Brew PENDING (review-bot timeout) ───→ outer loop waits → Taste
Taste PENDING (product CI on any host / bot timeout / new push) ───→ outer loop waits → fresh Taste
Taste waits in-process for Bugbot/CodeQL ───→ same invocation reacts
Taste PASS ────────────→ merge-ready
Any BLOCKED ───────────→ human/external gate
```

The loop persists the execution state, starts a fresh agent for Grow, for the first
Pick or Roast entry, and for Brew/Taste, honors `next`, waits on `PENDING` (`wait`
seconds), and stops on `PASS` or `BLOCKED` according to policy. It must not turn a human
decision into retries. It must not reinvoke Pick or Roast between tasks while the inner
loop can continue. Stage YAML is loop/skill data; keep it collapsed for humans. Brew and
Taste themselves wait until async review bots on the current head have reported,
preferring provider CLI watch hooks or harness subscriptions; the loop does not need to
reinvoke for that wait.

Two invocable outer-loop skills ship beside the five stages. They are not stages:

| Skill | Loop |
| --- | --- |
| `terreno-planning-loop` | Walk Grow/Pick/Brew/Taste. Default Grow once, then Pick once (Pick owns the pick-roast inner loop). Pass `phases=` (`grow`, `pick`, `roast`, `brew`, `taste`) to restrict. |
| `terreno-taste-sweep` | Find the author's open non-draft PRs that are conflicting or failing, isolate each one, and reinvoke Taste until mergeable or blocked. |

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

Invoking Pick is enough to run the inner loop until the approved task list is done.
Invoking Roast proves the current task only and emits `next: pick` or `next: brew`.
Roast never invokes Pick. Do not start the next task until Roast PASS. Exactly one driver continues after each current-task Roast: Pick owns the inner loop.

## Feature profile (formerly Grind)

For one bounded feature, the loop may use a compact approved task file instead of a full
IP when repository policy permits:

1. Invoke Grow to research/grill and write the compact task contract.
2. Invoke Pick once. It implements one unblocked task, roasts it, then picks the next
   until the list is done. Do not dispatch parallel Picks and roast once at the end.
3. When the inner loop emits `PASS` with `next: brew`, invoke Brew, then fresh Taste
   iterations.

The inner loop, not a long-lived parent agent outside Pick/Roast, marks tasks, persists
per-task results in execution state, and continues to the next frontier task.

## Backend/API scenario

- Grow shapes the model/API contract, acceptance criteria, and discoverable supporting
  skills.
- Pick loads applicable API, schema, and test-environment skills and implements with TDD
  one task at a time.
- Roast independently exercises that task's routes, integration/database behavior, and
  regressions before the next task starts.
- Brew submits only after every in-scope task has Roast `PASS`.
- Taste reacts to the current CI/review state until the loop receives `PASS`. Before
  exiting, it waits until Bugbot, CodeQL, and similar review bots on this head have
  reported, preferring native watch/subscription hooks, then acts on those results.

## UI scenario

- Grow shapes UX, API, state, and observable verification criteria.
- Pick loads applicable UI conventions and implements/tests one task's behavior.
- Roast loads the repository's UI verification capability, launches the real app,
  exercises the changed workflow, and records media evidence before the next task.
- Brew attaches evidence after the inner loop completes.
- A Taste fix that changes UI reruns the required UI verification, pushes, and returns
  `PENDING` for the new head.

## CI/review scenario

1. Brew pushes the PR, uses native watch/subscription hooks where available until
   Bugbot/CodeQL (if running) are terminal, records outcomes, and exits with
   `next: taste` without implementing fixes.
2. Taste waits if those bots are still running, then sees a branch-caused CI failure on
   SHA A (from GitHub Actions, CircleCI, Buildkite, or any other discovered host), fixes
   and verifies it, pushes SHA B, waits again for review bots on B, and
   acts once on those results. A further push emits `PENDING` and exits.
3. The outer loop uses the provider's native watch hook or a harness subscription for
   product CI on any remaining host (falling back to the requested timer), then invokes
   fresh Taste. It sees green jobs plus an actionable human review comment, fixes it,
   waits for review bots on the new head, and emits `PENDING` or `PASS`.
4. When all jobs on every discovered host are terminal/pass, no conflicts, and no
   actionable comments remain, Taste emits `PASS`.
