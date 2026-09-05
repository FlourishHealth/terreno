# GitHub issue lifecycle (create → plan → Pick/Roast)

File issues so an agent can select them, post a Pick plan, implement with
`terreno-2-pick`, and roast against that plan.

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

## After Roast PASS

Inner-loop PASS does not open a PR. Invoke `/terreno-4-brew` when you want the draft
PR.

## Related

- [Install agent skills](install-agent-skills.md)
- [Lifecycle plugin](../reference/lifecycle-plugin.md)
- [Loop engineering](../explanation/loop-engineering.md)
- [Public roadmap process](../explanation/roadmap-process.md) — separate from this
  issue → Pick path
