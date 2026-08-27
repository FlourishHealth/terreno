# Lifecycle plugin reference

Plugin: `terreno-planning` (`2.3.0`)

All five stage skills are explicitly invoked (`disable-model-invocation: true`) and
implement one bounded transition. `terreno-planning-loop` and `terreno-taste-sweep` are
outer loops that invoke those stages; they are not stages and must not appear as
`stage` values.

| Skill | Preconditions | Primary output | PASS next |
| --- | --- | --- | --- |
| `terreno-1-grow` | request/spec + repository | approved IP/tasks + criterion/verification map | Pick |
| `terreno-2-pick` | approved task + branch/state | implemented slice + tests/internal reviews | Roast |
| `terreno-3-roast` | Pick result + current diff | independent requirement/evidence verdict | Brew |
| `terreno-4-brew` | Roast PASS + branch/evidence | pushed head + PR + review-bot wait + attached evidence | Taste |
| `terreno-5-taste` | PR + current state | one current-head reaction after review-bot wait | null or fresh Taste |

Outer loops (not stages):

| Skill | What it walks | Default |
| --- | --- | --- |
| `terreno-planning-loop` | Approved task list | Grow once, then Pick and Roast each remaining task. Pass `phases=` to restrict (`grow`, `pick`, `roast`, `brew`, `taste`). |
| `terreno-taste-sweep` | Author's open broken PRs | Isolate each conflicting or failing non-draft PR and reinvoke Taste until mergeable or blocked. |

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

The outer loop owns state persistence, product-CI waiting, stage invocation, retries, and
escalation. Brew and Taste sleep until async review bots (Bugbot, CodeQL, and similar) on
the current head have reported, then continue; they do not wait for ordinary product CI.
Brew still does not execute Taste.

GitHub communication follows a fixed attention budget: `Why`, `What changed`, and
`Verification` are the only visible PR sections; optional detail is expandable; comments
are reserved for blocked decisions or non-obvious review resolutions.

Every stage follows the
[documentation contract](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/documentation-contract.md):
read architecture docs before acting, update them in the same slice, and fail the slice
when user-visible or architectural behavior ships without matching docs.

Install the published skill set (lifecycle stages, outer loops, plus repo and package skills):

```bash
npx skills add FlourishHealth/terreno
```

Regenerate the committed `skills/` tree with `bun run skills:sync`. Package skills under
`<package>/.ai/skills/` overlay the repo copies.

Exact commands and domain conventions are supplied by repository-local skills discovered
at stage start; they are not bundled into the lifecycle plugin.

