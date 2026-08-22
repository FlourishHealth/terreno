# Lifecycle plugin reference

Plugin: `terreno-planning` (`2.0.0`)

All five skills are explicitly invoked (`disable-model-invocation: true`) and implement
one bounded transition.

| Skill | Preconditions | Primary output | PASS next |
| --- | --- | --- | --- |
| `terreno-1-grow` | request/spec + repository | approved IP/tasks + criterion/verification map | Pick |
| `terreno-2-pick` | approved task + branch/state | implemented slice + tests/internal reviews | Roast |
| `terreno-3-roast` | Pick result + current diff | independent requirement/evidence verdict | Brew |
| `terreno-4-brew` | Roast PASS + branch/evidence | pushed head + PR + attached evidence | Taste |
| `terreno-5-taste` | PR + current state | one current-head reaction result | null or fresh Taste |

Every stage includes:

- Preconditions
- Inputs
- Procedure
- Supporting skills
- Evidence produced
- Success, failure, and blocked conditions
- Recommended next stage

Results use `PASS`, `FAIL`, `BLOCKED`, or `PENDING` and follow
[`stage-result.schema.json`](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/stage-result.schema.json).
Loop state follows
[`execution-state.schema.json`](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/execution-state.schema.json).

The outer loop owns state persistence, waiting, stage invocation, retries, and escalation.
Brew exits after PR setup. Taste observes/acts once and exits.

Exact commands and domain conventions are supplied by repository-local skills discovered
at stage start; they are not bundled into the lifecycle plugin.

