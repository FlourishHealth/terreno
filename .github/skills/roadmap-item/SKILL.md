---
name: roadmap-item
description: >-
  Draft or update a Terreno roadmap tracking issue for an approved
  implementation plan — correct labels, Project fields, and house-style body,
  applied only after maintainer approval. Trigger with /roadmap-item or phrases
  like "create a roadmap item", "add this IP to the roadmap", "update the
  roadmap entry".
---
# Roadmap item

Create or update the public tracking issue for a piece of planned work, usually one approved IP in `docs/implementationPlans/`.

**What lands on the public roadmap is a human decision.** Draft it, validate it, then stop for approval.

Process background, including the full IP ↔ roadmap lifecycle and the promote-vs-item ownership table: [`docs/explanation/roadmap-process.md`](https://github.com/FlourishHealth/terreno/blob/master/docs/explanation/roadmap-process.md).

## Where this sits in the lifecycle

`roadmap-item` is the stage that ties an **approved IP** to its public tracking issue.
It is the only skill that sets the Project `IP` field and moves an item to `Status=Planned`.

- If the work started as a community discussion, `roadmap-promote` already opened a
  `Shaping` issue. **Update that issue** (Step 2 finds it) — set the `IP` field and move
  it `Shaping → Planned`. Never open a second issue for the same work.
- If the IP is internal-origin with no discussion behind it, **create** the issue here at
  `Planned`.
- The planning pipeline's **Blend** stage hands off here once an IP reaches Approved (in
  repos that run a roadmap). In a repo with no roadmap board, there is nothing to do —
  the IP and its task list are the source of truth.

## When to use

- An IP has reached **Approved** and needs its public tracking issue
- An existing roadmap item's status, target, or scope has changed
- Backfilling tracking issues from [`docs/explanation/roadmap-seed-issues.md`](https://github.com/FlourishHealth/terreno/blob/master/docs/explanation/roadmap-seed-issues.md)

## When not to use

- The work came from a community discussion — use `roadmap-promote`, which credits and links the thread
- The item just needs labels — use `roadmap-triage`
- Auditing the whole board — use `roadmap-review`
- Writing the IP itself — use `ip`

## Hard rules

1. **Never create or edit an issue, or change a Project field, without explicit approval of the drafted text in this conversation.**
2. **Never promote an IP that is not Approved.** Read its status header; if it says Draft or Proposed, stop and say so.
3. **Never invent labels or field values.** Validate with `bun run roadmap:check` first.
4. Write for an outside reader. A roadmap entry that only makes sense to the team defeats the point of a public roadmap.

## Procedure

### 1. Read the plan

Read the IP and its task list. Extract:

| Field | Where it comes from |
|---|---|
| Outcome | The IP's Goal section, restated for a reader who has not seen it |
| Area | The packages it touches |
| Impact | `Breaking` / `Feature` / `Improvement` / `Fix` |
| Target | The release it is aimed at, or `Next` / `Future` |
| Status | `Planned` until work starts |
| Dependencies | The IP's "Depends on" line |

If the IP declares an RTK deprecation flag of **Blocked**, the item still gets `Status=Planned` — the Project Status field has no `Blocked` option. Carry the gating with the `status:blocked` label and say what it is waiting on.

### 2. Check for an existing item

```bash
gh issue list --search "\"$IP_SLUG\" in:body" --state all --json number,title,url,state
```

Update the existing issue rather than opening a duplicate.

### 3. Draft

House style, matching the seed issues:

- **Title:** `[Roadmap] <outcome>`
- **Body:** two or three paragraphs of plain language — what is broken or missing today, what changes when it ships, and what is explicitly out of scope. No task breakdown; that is the task list's job
- **Links:** the IP and the task list, as full GitHub URLs (the docs site excludes `implementationPlans/` and `tasks/`, so relative links break there)
- **Dependencies:** name them and link their issues

### 4. Validate

```bash
bun run roadmap:check --labels "area:deploy,type:feature" --status Planned --target Next --impact Improvement --area deploy
```

Run it with no arguments to list every valid option.

### 5. Plan and confirm (required)

Print, then **stop and wait**:

- IP slug and its recorded status, quoted from the IP header
- Whether this creates a new issue or updates an existing one, with the URL if it exists
- The complete title and body, verbatim
- Labels and field values, with the `roadmap:check` result
- Every command you would run
- Anything you inferred rather than read from the IP

### 6. Apply, after approval

```bash
gh issue create --title "$TITLE" --body-file "$BODY_FILE" --label "area:deploy,type:feature"
gh project item-add "$PROJECT_NUMBER" --owner FlourishHealth --url "$ISSUE_URL"
```

Resolve field IDs with `gh project field-list "$PROJECT_NUMBER" --owner FlourishHealth --format json` before `gh project item-edit`, or set single-selects in the UI.

### 7. Report

Give the issue URL, the labels and fields actually applied, and anything the maintainer still needs to set by hand.

`ROADMAP.md` is generated from the board on a schedule — do not hand-edit it to match. If the maintainer wants it refreshed now, run `bun run roadmap:generate` (needs `GITHUB_TOKEN` with `read:project` and `TERRENO_PROJECT_NUMBER`).
