# Lifecycle plugin reference

Plugin: `terreno-planning` (`2.3.0`)

All five skills are explicitly invoked (`disable-model-invocation: true`). Grow, Brew,
and Taste each implement one bounded transition. Pick continues an inner loop until the
approved task list is done. Roast proves the current task and returns.

| Skill | Preconditions | Primary output | PASS next |
| --- | --- | --- | --- |
| `terreno-1-grow` | request/spec + repository | approved IP/tasks + criterion/verification map | Pick (enters inner loop) |
| `terreno-2-pick` | approved task + branch/state | one implemented slice, then Roast, then the next task | Roast, or Brew when the list is done |
| `terreno-3-roast` | Pick result + current diff | independent requirement/evidence verdict for the current task | emit Pick if tasks remain, else Brew; never invoke Pick |
| `terreno-4-brew` | Roast PASS for every in-scope task + branch/evidence | pushed head + PR + review-bot wait + attached evidence | Taste |
| `terreno-5-taste` | PR + current state | one current-head reaction after review-bot wait | null or fresh Taste |

Every stage includes:

- Preconditions
- Inputs
- Procedure
- Supporting skills
- Evidence produced
- Success, failure, and blocked conditions
- Recommended next stage

Results use `PASS`, `FAIL`, `BLOCKED`, or `PENDING` and the compact `v: 2` schema
[`stage-result.schema.json`](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/stage-result.schema.json)
(`v`, `stage`, `status`, `next`, `action`; omit empty keys). Loop state follows
[`execution-state.schema.json`](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/execution-state.schema.json).
Chat and PRs show `status` / `next` / `action`; the YAML lives in a Details toggle.

The outer loop owns state persistence, product-CI waiting, Grow/Brew/Taste invocation,
retries, and escalation. Pick owns the
[pick-roast inner loop](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/pick-roast-loop.md):
one task, roast it, next task. Roast never invokes Pick. Do not start the next task
until Roast PASS. Exactly one driver continues after each Roast. Brew and
Taste sleep until async review bots (Bugbot, CodeQL, and similar) on the current head
have reported, then continue; they do not wait for ordinary product CI. Brew still does
not execute Taste.

GitHub communication follows a fixed attention budget: `Why`, `What changed`, and
`Verification` are the only visible PR sections; optional detail is expandable; comments
are reserved for blocked decisions or non-obvious review resolutions.

Every stage follows the
[documentation contract](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/documentation-contract.md):
read architecture docs before acting, update them in the same slice, and fail the slice
when user-visible or architectural behavior ships without matching docs.

Install the published skill set (lifecycle stages plus repo and package skills):

```bash
npx skills add FlourishHealth/terreno
```

Regenerate the committed `skills/` tree with `bun run skills:sync`. Package skills under
`<package>/.ai/skills/` overlay the repo copies.

Exact commands and domain conventions are supplied by repository-local skills discovered
at stage start; they are not bundled into the lifecycle plugin.
