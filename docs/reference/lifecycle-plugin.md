# Lifecycle plugin reference

Plugin: `terreno-planning` (`2.5.0`)

Planning skills are model-invocable: agents may select them from descriptions, not only
from slash commands. Grow, Brew, and Taste each implement one bounded transition. Pick continues an inner loop until the
approved task list is done. Roast proves the current task and returns.
`terreno-planning-loop` and `terreno-taste-sweep` are outer loops that invoke those
stages; they are not stages and must not appear as `stage` values.

| Skill | Preconditions | Primary output | PASS next |
| --- | --- | --- | --- |
| `terreno-1-grow` | request/spec + repository | approved IP/tasks + criterion/verification map | Pick (enters inner loop) |
| `terreno-2-pick` | approved task + branch/state | one implemented slice, then Roast, then the next task | Roast, or Brew when the list is done |
| `terreno-3-roast` | Pick result + current diff | independent requirement/evidence verdict for the current task | emit Pick if tasks remain, else Brew; never invoke Pick |
| `terreno-4-brew` | Roast PASS for every in-scope task + branch/evidence | pushed head + PR + product-CI trigger check + review-bot wait + attached evidence | Taste |
| `terreno-5-taste` | PR + current state | one current-head reaction; before push: pull latest `master`, lint in a no-context subagent, then watch CI | null or fresh Taste |

Outer loops (not stages):

| Skill | What it walks | Default |
| --- | --- | --- |
| `terreno-planning-loop` | Approved task list | Grow once, then Pick once (inner pick-roast loop). Pass `phases=` to restrict (`grow`, `pick`, `roast`, `brew`, `taste`). |
| `terreno-taste-sweep` | Author's open broken PRs | Isolate each conflicting or failing (any discovered CI host) non-draft PR and reinvoke Taste until mergeable or blocked. |

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

The outer loop owns state persistence, Taste `PENDING` reinvocation, Grow/Brew/Taste
invocation, retries, and escalation. Pick owns the
[pick-roast inner loop](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/pick-roast-loop.md):
one task, roast it, next task. Roast never invokes Pick. Do not start the next task
until Roast PASS. Exactly one driver continues after each Roast. Brew and Taste wait
until async review bots (Bugbot, CodeQL, and similar) on the current head have reported,
preferring provider CLI watch hooks or harness event subscriptions over sleep polling.
Taste then waits in a loop for product CI using GitHub CLI (`gh pr checks --watch`,
`gh run watch`) or CircleCI CLI (`circleci run watch`) until jobs are terminal or the
wait times out. Before any push, Taste always pulls latest `master`, then spawns a
fresh subagent with no parent conversation to run `bun lint` in each affected package
and the locally affected tests, then pushes and watches product CI.
Taste observes product CI on every discovered host (GitHub Actions, CircleCI,
Buildkite, and similar), not only GitHub checks. A documented not-applicable host
counts as skipped; an unexplained untriggered host prevents Brew `PASS`. Brew still
does not execute Taste.

GitHub communication follows a fixed attention budget: `Why`, `What changed`, and
`Verification` are the only visible PR sections; optional detail is expandable; comments
are reserved for blocked decisions or non-obvious review resolutions.

Every stage follows the
[documentation contract](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/documentation-contract.md):
read architecture docs before acting, update them in the same slice, and fail the slice
when user-visible or architectural behavior ships without matching docs. Brew and Taste
observe product CI per
[product-ci.md](https://github.com/FlourishHealth/terreno/blob/master/plugins/terreno-planning/references/product-ci.md).

Install the published skill set (lifecycle stages, outer loops, plus repo and package skills):

```bash
npx skills add FlourishHealth/terreno
```

Or install the same five stages as a host plugin:

| Host | Plugin | Stage names | Invoke Grow |
| --- | --- | --- | --- |
| Cursor | `terreno-planning` | `terreno-1-grow` … `terreno-5-taste` | `/terreno-1-grow` |
| Codex | `terreno-planning` | `terreno-1-grow` … `terreno-5-taste` | `$terreno-1-grow` |
| Claude Code | `terreno` | `1-grow` … `5-taste` | `/terreno:1-grow` |
| `npx skills` | — | `terreno-1-grow` … `terreno-5-taste` | `/terreno-1-grow` |

Cursor installs `terreno-planning` from [`.cursor-plugin/marketplace.json`](https://github.com/FlourishHealth/terreno/blob/master/.cursor-plugin/marketplace.json). Codex:

```text
codex plugin marketplace add FlourishHealth/terreno
codex plugin install terreno-planning --source terreno-plugins
```

Codex reads [`.agents/plugins/marketplace.json`](https://github.com/FlourishHealth/terreno/blob/master/.agents/plugins/marketplace.json)
and `.codex-plugin/plugin.json` on the canonical plugin. Claude Code:

```text
/plugin marketplace add FlourishHealth/terreno
/plugin install terreno@terreno-plugins
```

Claude Code resolves a plugin skill's command from the frontmatter `name`, so the short
names ship as a generated Claude-only copy at
[`plugins/terreno-claude/`](https://github.com/FlourishHealth/terreno/tree/master/plugins/terreno-claude).
Stage procedure, contracts, and references are identical to the canonical
`plugins/terreno-planning/skills/` tree.

Regenerate the committed `skills/` tree and the Claude plugin with `bun run skills:sync`.
Package skills under `<package>/.ai/skills/` overlay the repo copies.

Exact commands and domain conventions are supplied by repository-local skills discovered
at stage start; they are not bundled into the lifecycle plugin.
