# GitHub issue lifecycle (create → plan → Pick/Roast)

File issues so an agent can select them, post a Pick plan, implement with
`terreno-2-pick`, and roast against that plan.

Two implementation paths, plus an unattended full-cycle path:

| Path | Gate | Skill |
| --- | --- | --- |
| Interactive | You confirm the queue and Pick plan in chat | `/work-github-issues` |
| Unattended (draft PR) | Maintainer applies `status:ready-for-dev` | `/implement-ready-for-dev` (Cursor Automation) |
| Unattended (mergeable PR) | Same label; Grow assumes defaults unless a genuine human gate | `/autobot-ready-for-dev` (Cursor Automation) |

## Create the issue

1. Invoke `/create-github-issue` (or open
   [Lifecycle work item](https://github.com/FlourishHealth/terreno/issues/new?template=work_item.yml)).
2. Fill **Affected package**, **Kind**, **Problem**, **Outcome**, **Current behavior**,
   **Non-scope**, **Acceptance**, and **Context**.
3. Stop until the drafted title, body, and labels are approved. Then create.

Existing [bug](https://github.com/FlourishHealth/terreno/issues/new?template=bug_report.yml),
[feature](https://github.com/FlourishHealth/terreno/issues/new?template=feature_request.yml),
and [docs](https://github.com/FlourishHealth/terreno/issues/new?template=docs_issue.yml)
forms still work. Prefer the lifecycle form when you want Roast-ready acceptance in
the body. The canonical heading list is in the
[`create-github-issue` skill](https://github.com/FlourishHealth/terreno/blob/master/.rulesync/skills/create-github-issue/references/issue-format.md).

`Affected package` must match a known value so issue triage can apply `area:*`.
`Kind` on the lifecycle form is applied as `type:*` by the same triage job.

## Plan and implement

1. Invoke `/work-github-issues`.
2. The agent lists recent open issues, ranks a queue of at most five, and drafts a
   Pick plan for one recommended issue.
3. Confirm the queue, answer clarifying questions, and approve the plan text.
4. The agent posts a comment that starts with `<!-- terreno-pick-plan -->` and
   **pins that comment URL**. Roast reloads that id. A later matching comment from
   someone who is not `OWNER` / `MEMBER` / `COLLABORATOR` is ignored.
5. Pick implements one task; Roast proves that comment; Pick continues until the list
   is done.

Do not skip the confirmation pause. Do not roast from chat after the comment exists.

Hand off to `/terreno-1-grow` when the plan needs more than five tasks or a
product/security/architecture decision.

## After Roast PASS (interactive)

Inner-loop PASS does not open a PR. Invoke `/terreno-4-brew` when you want the draft
PR.

## Unattended pickup

1. After triage, apply `status:ready-for-dev` and leave the issue unassigned.
   Do not edit the issue body after you label it unless you are a maintainer; pickup
   aborts if an untrusted author changes the body after the label.
   Use `/implement-ready-for-dev` only when Acceptance is already roastable and the work
   fits one Pick comment (at most five tasks). Use `/autobot-ready-for-dev` when Grow
   should shape the issue and Taste should leave a mergeable PR.
2. A Cursor Automation claims the oldest matching
   issue: assignee + `status:in-progress`, remove `status:ready-for-dev`. It skips
   issues that already have an open linked or closing PR (GraphQL references, not
   `linked:<number>`).
3. **`/implement-ready-for-dev`** posts `<!-- terreno-pick-plan -->` from that trusted
   snapshot, Pick ⇄ Roasts that comment, then Brews a **draft** PR with `Fixes #<n>`.
   It does not Grow and does not Taste. Dashboard paste:
   [`implement-ready-for-dev` automation](../../.rulesync/skills/implement-ready-for-dev/references/cursor-automation.md).
4. **`/autobot-ready-for-dev`** runs Grow on that snapshot, answers Grow questions from
   the repo and issue (assumptions posted on the issue), and only stops on GitHub for a
   genuine human gate. Then Pick ⇄ Roast, Brew, and Taste until the PR is mergeable
   (ready for review). Do not merge. Dashboard paste:
   [`autobot-ready-for-dev` automation](../../.rulesync/skills/autobot-ready-for-dev/references/cursor-automation.md).

Do not run both automations against the same label; they race to claim.

Do not apply `status:ready-for-dev` to issues that still need a product, security, or
data-ownership decision. Those stay `status:needs-info` or go through `/work-github-issues`.
Autobot will assume implementation defaults; it will not invent those decisions.

Labels live in [`.github/labels.yml`](https://github.com/FlourishHealth/terreno/blob/master/.github/labels.yml).
Sync them with the existing roadmap labels workflow before expecting pickup.

## Related

- [Install agent skills](install-agent-skills.md)
- [Lifecycle plugin](../reference/lifecycle-plugin.md)
- [Loop engineering](../explanation/loop-engineering.md)
- [Public roadmap process](../explanation/roadmap-process.md) — separate from this
  issue → Pick path
- [`implement-ready-for-dev` skill](../../.rulesync/skills/implement-ready-for-dev/SKILL.md)
- [`autobot-ready-for-dev` skill](../../.rulesync/skills/autobot-ready-for-dev/SKILL.md)
