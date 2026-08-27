# Loop engineering

Terreno separates engineering method from orchestration:

```text
                 LOOP
       orchestrate / persist / wait
          retry / stop / escalate
                  |
                  v
               GROW
               shape
                  |
                  v
         PICK ⇄ ROAST  (inner loop)
         one task, prove it, next task
                  |
                  v
               BREW
              submit
                  |
                  v
              TASTE
             react once
```

Repository knowledge composes underneath every invocation:

```text
lifecycle stage + project skills + IP/task/state + evidence
```

## Why fresh invocations

One enormous agent context accumulates assumptions, stale external state, and confidence
in its own implementation. The lifecycle instead makes every stage reconstructable from
durable artifacts. Pick can retry from exact Roast evidence; Roast can verify without the
implementer's assumptions; Taste can react to the current PR head rather than an old
green result.

Pick continues across tasks in one invocation. Roast proves the current task and
returns. Each Roast cycle still reconstructs from artifacts and prefers a fresh context.
That is how the inner loop stays automated without turning Roast into a self-review or
a second driver.

The outer loop decides **when, who, what next, when to retry, when to wait on product
CI, and when to escalate**. Stages decide how to perform one transition correctly. Pick
continues the inner loop until the approved task list is done. Roast never invokes Pick.
Brew and Taste additionally wait while async review bots are running, preferring
provider CLI watch hooks or harness event subscriptions over timer polling.

Invocable outer loops in the plugin: `/terreno-planning-loop` runs Grow, then Pick
(Pick owns the pick-roast inner loop), then optional Brew/Taste; pass `phases=` to
restrict. `/terreno-taste-sweep` drives the author's broken open PRs by reinvoking
Taste. Neither is a sixth stage.

## The five transitions

| Stage | Question | Primary evidence |
| --- | --- | --- |
| Grow | Is the work shaped and approved? | IP/tasks, decisions, criterion→verification map |
| Pick | Was this slice implemented carefully? | red/green tests, checks, internal reviews; then Roast |
| Roast | Does this task actually satisfy its criteria? | independent requirement→evidence verdict; emit next Pick or Brew |
| Brew | Is the verified result correctly submitted? | final checks, commit/head, PR, artifacts |
| Taste | What is actionable on the current PR head now? | CI on every discovered host, mergeability, reviews, bounded fixes |

Roast is not another implementation review. It independently proves or disproves
acceptance criteria. Taste is not a resident watcher of product CI. It waits until async
review bots (Bugbot, CodeQL, and similar) on the current head have reported, preferring
targeted hooks such as `gh run watch <run-id>`, then observes jobs on every discovered CI
host (GitHub Actions, CircleCI, Buildkite, and similar), acts, emits `PASS`, `FAIL`,
`BLOCKED`, or `PENDING`, and exits.

An outer loop may watch all product checks. Brew/Taste review-bot waits use only hooks
targeted to the matched bot so ordinary CI cannot extend the in-stage wait. A host with
a documented path/config reason not to run is terminal `skipped`; an unexplained missing
run is never green.

## Portable plugin, local knowledge

The reusable plugin defines contracts, invariants, evidence, and transitions. Repo-local
skills define exact API/UI/database patterns, commands, test environments, generated
code, deployment, and safety rules.

Each stage inspects available skills and loads those whose descriptions match the
affected domain. A useful skill is optional when absent; a capability required by
repository policy is a hard gate and produces `BLOCKED` if unavailable.

Stages also load architecture docs before acting. Docs are the design; code implements
them. Missing docs for a user-visible or architectural change is `FAIL`.

This lets the same Pick method compose with backend API and test-environment knowledge,
while Roast composes with UI conventions and real-app verification.

### Terreno's current project-skill layer

The canonical sources remain under `.rulesync/skills/` and are generated for supported
agents. The current high-value composition points include:

| Domain | Repo-local skills stages may discover |
| --- | --- |
| Backend/API/data | `terreno-backend-api`, `mongoose-schema-safety`, `backend-test-env`, `generate-sdk`, `terreno-data-fetching` |
| UI/app | `terreno-ui`, `building-terreno-apps`, `building-native-ui`, `verify-ui-changes` |
| AI/prompts | `ai-prompt-governance` |
| Docs/submission | `update-docs`, `commit`, `create-pr`, `fix-conflicts` |
| Deployment/runtime | `deploy-gcp`, Expo deployment/workflow skills |

This inventory is descriptive, not a plugin dependency list. Stages inspect the actual
catalog on every invocation.

## State and evidence

The IP remains the design/scope source of truth. The task file remains the execution
checklist. Lightweight loop-owned state stores only current stage/attempt/task,
branch/head/PR, the previous structured result, artifacts, attempted approaches, and next
transition.

The fallback state location is `.terreno/pipeline/<slug>.json`; the outer loop preserves
or transports it and Brew excludes it from commits unless repository policy says
otherwise. Stage results follow the plugin's JSON-schema-backed YAML contract and never
contain chain-of-thought or transcripts.

## Retry and stop rules

- Pick implements one task, Roast proves it, then Pick takes the next unblocked task.
  Do not start the next task until Roast PASS. Roast never invokes Pick. Exactly one
  driver continues after each Roast. Do not pick every task and roast once.
- Roast failure returns exact expected/actual evidence to Pick for the same task.
- Engineering retries require a new hypothesis and preserve failed approaches.
- Taste `PENDING` lets the outer loop wait on remaining product CI (any discovered host)
  or a review-bot timeout, then invoke fresh Taste against current state. The loop uses
  native provider watch hooks or harness subscriptions where available and a timer only
  as fallback.
- Brew and Taste wait in-process while Bugbot, CodeQL, or similar review bots are
  running, preferring native hooks, then continue without a loop reinvocation.
- Human decisions are `BLOCKED`, never arbitrary retries.
- Taste `PASS` requires all current-head jobs on every discovered CI host
  terminal/non-failing, no conflicts, and no actionable review findings.

The detailed contract, schemas, and three execution scenarios live under
[`plugins/terreno-planning/references/`](https://github.com/FlourishHealth/terreno/tree/master/plugins/terreno-planning/references).

