# Pick–Roast inner loop

Pick and Roast run as one automated inner loop until the approved task list is done.
The outer loop still owns Grow, Brew, Taste, persistence, product-CI waiting, and
escalation. It does not wait between Pick and Roast, and it does not wait for a human to
reinvoke the next frontier task.

```text
Grow PASS
    → Pick (one unblocked task)
    → Roast (that task only)
         FAIL → Pick (same task, exact evidence)
         PASS + remaining unblocked tasks → Pick (next frontier task)
         PASS + no remaining unblocked tasks → Brew
Any BLOCKED → emit and exit to the named gate
```

## Bounds

The inner loop is bounded by the approved task graph, not by CI or wall-clock:

- One Pick implements exactly one current unblocked task.
- Roast proves that task before any later task starts.
- Do not start the next task until Roast PASS.
- Roast FAIL retries the same task with a new hypothesis; do not repeat a failed
  approach without new evidence.
- Exhausted retries, human/environment/access/external gates, or missing mandatory
  verifiers emit `FAIL` or `BLOCKED` and **exit**. The inner loop does not invent scope.
- Terminal inner-loop `PASS` requires every in-scope task to have a Roast `PASS` on the
  recorded head. Only then is `next: brew`.

Do not pick every task first and roast once at the end. Do not roast the whole IP after
the first Pick. Do not run independent frontier tasks in parallel inside this loop.

## Who executes whom

Invoking **Pick** or **Roast** enters this loop. Exactly one driver continues after each
current-task Roast. Do not let a parent Pick and a Roast subagent both start the next
task.

- After Pick records a completed slice, **invoke Roast to prove that task only**. Prefer
  a fresh context or subagent when the harness allows. If a fresh context is unavailable,
  execute Roast from durable artifacts only and ignore Pick's completion claims.
- When Pick invoked Roast, Roast proves, records, and **returns** to Pick. Roast does
  not invoke Pick for the next task.
- Pick then continues: Reconstruct the next frontier task, including architecture docs
  and supporting skills for that slice, or emit `next: brew` when none remain.
- When **Roast is the entry skill**, `PASS` with remaining unblocked tasks → invoke Pick
  once. That Pick owns the rest of the loop, including later prove-only Roast cycles.
- After Roast `FAIL`, return evidence to the parent Pick, or invoke Pick for the same
  task when Roast is the entry, with the exact `need` / `want` / `got` / `ev` evidence.
- Pick never skips Roast. Roast never implements the next slice itself.

Each cycle writes execution state (`task`, `attempt`, `last`, `tried`, `next`) before
continuing. The invocation emits one terminal stage result: the last cycle that stops
the loop. Intermediate cycle results live in execution state, not as extra human-facing
YAML dumps.

## Independence

Roast remains the authoritative verifier. Pick's internal reviews are not proof. Roast
reconstructs the head and artifacts independently, maps in-scope criteria for **the
current task**, and classifies each with evidence. It does not fix implementation
defects.

When Roast runs in-process after Pick, it still must not trust conversational memory of
the implementation. Fresh context is preferred, not optional when the harness can spawn
one.

## Entry and exit

| Entry | Behavior |
| --- | --- |
| Grow `PASS` / human invokes Pick | Start at the next unblocked incomplete task |
| Human invokes Roast after a Pick cycle | Prove the current task, then continue the loop |
| Roast `FAIL` from a prior invocation | Pick retries that task, then Roast, then continue |

| Stop | `next` |
| --- | --- |
| All in-scope tasks have Roast `PASS` | `brew` |
| Pick or Roast objective failure after focused retry | `pick` or `roast` as named by evidence, and **exit** when the invocation cannot continue safely |
| Unresolved gate | `null` (`BLOCKED`) |

Brew preconditions require this terminal Roast `PASS` across the in-scope task list, not
a Roast of only the last slice while earlier slices are unproven.
