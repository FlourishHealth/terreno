---
name: claude-design-to-linear
description: >-
  Turn a Claude Code design into small Linear projects with required
  Implementation Plan and Execution issues, while updating existing projects
  instead of recreating duplicates.
---
# Claude Design to Linear Projects

Use this skill when the user wants to take a Claude Code design, design doc, implementation plan, or feature breakdown and turn it into Linear projects and issues.

## Non-negotiable contract

1. **Linear auth is required before anything else.**
   - First call `GetMcpTools` for the `Linear` server.
   - If the server status is `needsAuth`, stop and tell the user to authenticate the Linear MCP server in Cursor desktop, then retry.
2. **Inspect existing Linear work before creating anything.**
   - Look at current projects and related issues first.
   - Updating or reshaping existing work is preferred over creating duplicates.
3. **Prefer more projects, not fewer.**
   - If you are unsure whether something belongs in one large project or two smaller ones, split it.
   - Do not group unrelated or weakly-related work just to reduce project count.
4. **Every project must include a planning issue.**
   - Each project must contain one issue titled exactly:
     - `$feature Implementation Plan`
5. **Execution issue shape is mandatory.**
   - If the feature is a single execution chunk, create one issue titled exactly:
     - `$feature Execution`
   - If the feature has multiple meaningful parts, do **not** create a generic `$feature Execution` issue.
   - Instead, create multiple execution issues with explicit slice names, for example:
     - `$feature Backend`
     - `$feature Frontend`
     - `$feature Permissions`
     - `$feature Rollout`
6. **Project scope must stay small.**
   - Each project should be scoped to at most 1-2 weeks of total work.
   - If the project feels larger than that, split it into multiple projects immediately.
7. **Do not casually destroy existing work.**
   - Retitle, update, move, or rescope existing projects/issues when possible.
   - Only close or replace existing Linear artifacts when they are clearly superseded, and mention that explicitly in the summary.

## Inputs

Expect one or more of:

- A Claude Code design file path
- Inline design text
- A previously generated implementation plan
- A feature brief that already describes phases, dependencies, or acceptance criteria

If the target Linear team or workspace is ambiguous, inspect existing projects first. Only ask the user when the tooling cannot disambiguate.

## Required workflow

### Step 0: Verify Linear access

1. Call `GetMcpTools` for the `Linear` server.
2. If auth is missing, stop and tell the user to authenticate.
3. If auth is available, inspect the tool schemas you need before calling them.

Do not guess tool names or parameters.

### Step 1: Load and understand the design

Read the design and extract:

- Feature areas
- Dependencies
- Explicit phases
- Risky or foundational work
- User-visible slices
- Backend/frontend/admin/migration/rollout workstreams
- Out-of-scope items

Produce a short internal breakdown:

```markdown
Feature candidates
- <candidate 1>
- <candidate 2>

Natural split points
- <boundary 1>
- <boundary 2>

Must-stay-together work
- <paired items>
```

If the design already includes phases, treat them as a starting point, not as a final answer. Split phases further whenever they exceed the project size limit.

### Step 2: Inventory current Linear projects and issues

Before creating anything:

1. List current projects for the relevant team/workspace.
2. Search for matching issues using:
   - exact feature names
   - normalized feature names
   - prior implementation plan issue titles
   - obvious aliases from the design
3. Read the candidate matching projects and their issues.

Build a quick reconciliation table:

| Needed feature slice | Matching project? | Matching issues? | Action |
|---|---|---|---|
| Auth hardening | Yes: "Auth cleanup" | Partial | Update existing |
| Admin filters | No | No | Create new |

### Step 3: Slice the design into small projects

Convert the design into the **smallest reasonable set of independently useful projects**.

#### Hard rules for splitting

Split into separate projects when any of these are true:

- A project would exceed 1-2 weeks total
- The work has more than one major dependency chain
- Backend and frontend can land independently
- Admin/internal tooling can ship separately from end-user features
- Migration/rollout work would distract from the main implementation
- One part is foundational and unblocks several later parts
- The design has multiple screens, workflows, or permission models that do not need to land together

#### Strong bias toward smaller projects

If a candidate project would need:

- 1 planning issue plus more than 3-4 execution issues, or
- more than 2 distinct workstreams

split it again.

#### Good project shapes

Prefer project scopes like:

- "Messaging attachments foundation"
- "Messaging attachments composer UI"
- "Messaging attachments admin controls"
- "Messaging attachments rollout and telemetry"

Avoid project scopes like:

- "Messaging attachments full launch"
- "All notifications improvements"
- "Admin + backend + mobile polish"

### Step 4: Decide the issue structure for each project

For each project, define a `$feature` label that matches the project title closely.

Then apply this rule:

#### Single-part feature

Create exactly:

- `$feature Implementation Plan`
- `$feature Execution`

Use this only when the execution work is one coherent chunk.

#### Multi-part feature

Create:

- `$feature Implementation Plan`
- multiple execution issues with concrete names

Examples:

- `Scheduling rules Implementation Plan`
- `Scheduling rules Backend`
- `Scheduling rules Admin UI`
- `Scheduling rules Validation`

Avoid generic names like `Part 1`, `Part 2`, or `Misc`.

### Step 5: Reconcile existing work instead of recreating it

When a matching project already exists:

1. Update the existing project title/description/scope rather than creating a new one.
2. Reuse existing issues whenever they clearly map to the required planning or execution slices.
3. Retitle issues to the required naming convention if needed.
4. Add only the missing issues.
5. Remove duplication by consolidating scope into the best existing issue instead of cloning content into a new one.

#### Matching heuristics

Treat a project or issue as a likely match when any of these are true:

- Exact title match after normalization
- Same feature slug
- Same design link or source reference
- Same implementation plan concept
- Same scoped deliverable, even if the old title is weaker

When in doubt between "update existing" and "create duplicate", update existing.

### Step 6: Project and issue content

Every project should have a concise description that includes:

- what this slice delivers
- what is intentionally excluded
- why it is its own project

Every `Implementation Plan` issue should capture:

- source design or doc
- scope summary
- open questions
- expected execution slices

Every execution issue should capture:

- exact deliverable
- dependencies
- acceptance notes
- exclusions when needed

Keep issue bodies short and operational. Do not paste the entire design into every issue.

## Decision framework

Use this quick rubric:

### One project is appropriate when

- there is one narrow deliverable
- one engineer could reasonably finish it in under 2 weeks
- execution is still one coherent chunk after removing planning

### Multiple projects are appropriate when

- the design contains multiple shippable increments
- there is a foundation layer plus follow-on product work
- several execution issues would otherwise accumulate under one project
- there are clearly separate backend, frontend, admin, or rollout slices

If both seem plausible, choose multiple projects.

## Output before mutating Linear

Before making changes, prepare a concise plan like:

```markdown
## Planned Linear Changes

### Update existing projects
- Project: <name>
  - Keep/update because: <reason>
  - Issues to retitle/add/remove: <summary>

### Create new projects
- Project: <name>
  - Why separate: <reason>
  - Required issues:
    - <feature> Implementation Plan
    - <feature> Execution

### Split decisions
- <large feature> was split into:
  - <project A>
  - <project B>
  - <project C>
```

If the design is straightforward and the target team is unambiguous, proceed immediately after forming this plan.

If there is genuine ambiguity about project boundaries or which existing project should absorb the work, ask the user one concise clarifying question before writing to Linear.

## Final summary format

After updating Linear, report:

```markdown
## Linear Project Sync Complete

### Updated projects
- <project>: <what changed>

### Created projects
- <project>: <why it was created>

### Issue structure
- <project>
  - <feature> Implementation Plan
  - <feature> Execution

- <project>
  - <feature> Implementation Plan
  - <feature> Backend
  - <feature> Frontend

### Splits made to keep scope small
- <large feature> -> <project A>, <project B>

### Existing work reused
- <old project/issue> -> <new role>
```

## Success criteria

The skill is only complete when all of these are true:

- [ ] Linear MCP access was verified first
- [ ] Current projects/issues were inspected before creation
- [ ] Existing matching projects were updated instead of duplicated
- [ ] Every project has a `$feature Implementation Plan` issue
- [ ] Single-part projects have exactly one `$feature Execution` issue
- [ ] Multi-part projects use multiple explicitly named execution issues
- [ ] No resulting project exceeds the 1-2 week scope limit
- [ ] The outcome prefers more small projects over fewer oversized ones
