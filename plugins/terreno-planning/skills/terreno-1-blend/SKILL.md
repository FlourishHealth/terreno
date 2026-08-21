---
name: terreno-1-blend
description: Turn a spec, Linear ticket, or feature request into an Implementation Plan (IP) document. Use ONLY for IP creation — not code implementation, PR submission, or post-PR review handling.
disable-model-invocation: true
---

# Blend

Turn a raw request into an Implementation Plan (IP) using the existing `/ip` structure and lifecycle.

## Overview

- Output is the IP document (plus optional acceptance criteria and optional E2E test scaffolding when requested).
- Keep scope bounded and explicit.
- Preserve existing project conventions, tool usage, and repository patterns.
- Prefer existing public test seams. Record the chosen seams and codebase test examples in the IP before task generation.
- **Question-first:** do not write the IP (or any section that commits product or architecture decisions) until blocking questions are asked and the user has answered. Present options as questions or labeled alternatives (A/B/C), not as a finalized plan.
- **Post-attack questions:** when the Attack and adjust phase (Step 10) runs, always follow with a dedicated question pass (Step 11) and user answers before treating the plan as implementation-ready.

## Pipeline context

Blend is stage 1 of the Terreno planning pipeline. The full flow is:

1. **Blend** (this skill) — plan: write the IP + task list.
2. **Roast** (`terreno-2-roast`) — implement via TDD from the approved IP.
3. **Cupping** (`terreno-3-cupping`) — independently verify against the IP.
4. **Pour** (`terreno-4-pour`) — commit, push, open the PR.
5. **Dial In** (`terreno-5-dialin`) — drive CI and the review loop until mergeable.

Blend always produces the same two artifacts, in every repo:

- **IP design doc** → `docs/implementationPlans/<slug>.md`
- **Execution task list** → `docs/tasks/<slug>.md`

These two files are the source of truth for the plan. External trackers (a GitHub
roadmap issue, a Linear issue, a discussion thread) are **links from the IP header**,
never a replacement for it. See [`docs/implementationPlans/README.md`](../../../../docs/implementationPlans/README.md).

## Project Registry

| Alias(es) | GitHub Repo | Local Dir |
|---|---|---|
| `ter`, `terreno` | `flourishhealth/terreno` | `~/src/terreno` |

If a project is not in the registry, resolve it with `gh repo view <input>`.

## Planning Workflow

### Step 0: Project setup (always first)

1. Run `gh auth status`; stop if auth is missing.
2. Resolve the project from `$PROJECT` (or ask user to choose).
3. Clone when missing.
4. Fetch latest default branch and create an IP worktree (`ip-draft` if needed).
5. Print ready summary (project, branch, path, latest base SHA/date).

### Step 1: Ingest PRD/spec

- `$PRD` is required for `/terreno-1-blend` when invoked as plan-from-text/file.
- If `$PRD` is missing, stop immediately and return: `Error: /terreno-1-blend requires a PRD as the first argument (either a file path or inline PRD text). Please re-run as /terreno-1-blend <path-or-text>.`
- Accept file path or inline text.
- Summarize problem, business impact, stakeholders, constraints.
- Ask for confirmation before research.

### Step 2: Research context

Produce a complete research artifact before any committed plan shape:

1. Scope statement and what will be investigated.
2. Deep codebase read (models/routes/screens/components/tests/docs/rules).
3. External research for APIs/libraries/best practices.
4. Findings document with summary, **candidate options with tradeoffs** (do not pick a single “chosen” architecture as fact), **open questions**, references. Avoid a narrative that reads like a finished implementation decision.
5. Identify prior-art tests for the same seams and any architecture friction that would make the change hard. Apply the deletion test: propose prefactoring only when removing a shallow wrapper would concentrate complexity rather than move it.
6. Save draft research; **stop** for user input on factual gaps or repo-specific ambiguities if needed.
7. Save final research as `research.md`.

### Step 3: Clarification pass (mandatory — blocks Steps 4–6)

**Stop here before writing the IP or task list with decided outcomes.**

1. Emit a numbered **Blocking questions** list: product scope, data ownership, API/auth patterns, UX/navigation, rollout/feature flags, migrations, and anything not inferable with high confidence from the PRD + repo.
2. For each item where multiple approaches exist, present **options** (e.g. A/B/C) and the tradeoffs — **do not state one option as the plan** until the user chooses.
3. Optionally add a short **Non-blocking / nice-to-have** questions section (can default if user defers).
4. **End this step with an explicit pause:** ask the user to answer the blocking questions (or explicitly approve named assumptions). **Do not proceed** to Step 4, Step 5, or Step 6 until you have those answers in the conversation.

If the user has not yet answered blocking questions, you may refine research or re-read code, but you must **not** write `docs/implementationPlans/` IP content or `docs/tasks/` as if decisions were final.

### Step 4: Shape (after answers)

Only after Step 3 answers (or explicit assumption approvals):

#### Phase 1: Models + APIs first

Draft the feature shape through data and contract boundaries:

- Model/schema changes, fields, relationships, indexes/plugins/migrations.
- API surface (methods, paths, auth, request/response contracts, errors).

#### Phase 2: Remaining shape

Define:

- Notifications and activity logging.
- UI flows/states/navigation and testID expectations.
- Delivery phases.
- Risks and mitigations.
- Explicit not-included scope.
- Testing decisions: public seams, observable behaviors, prior-art test files, and external boundaries that may use injected fakes.

Ground every decision in the user’s answers; call out any residual ambiguity as a follow-up question before generating the IP.

### Step 5: Plan sections (optional deep pass)

Deepen any section as needed (same section list as before). Skip or shorten if the user wants a lighter IP.

1. Models
2. APIs
3. Notifications
4. UI
5. Phases
6. Feature flags and migrations
7. Activity log and user updates
8. Not included / future work

### Step 6: Generate IP output

Write the final IP with the same structure used by legacy `/ip`:

- Models
- APIs
- Notifications
- UI
- Phases
- Feature flags & migrations
- Activity log & user updates
- Testing decisions
- Not included / future work
- Task list of tracer-bullet vertical slices

Persist planning artifacts in the standard repo paths:

- Save the final IP document under `docs/implementationPlans/`.
- Save the executable task breakdown under `docs/tasks/`.

In the IP header, record links to any external trackers this work already has, and
leave them out when they do not apply:

- `Discussion:` — the originating GitHub Discussion (Ideas/RFC), when the work came from one.
- `Roadmap issue:` — the public tracking issue, once `roadmap-promote` or `roadmap-item` has created it.
- `Linear:` — the internal Linear issue, in repos that use Linear.

These are pointers. The IP body, not the tracker, holds the design.

### Task-list contract

Build `docs/tasks/<slug>.md` as dependency-aware tracer bullets:

1. Each task delivers a narrow, complete, demoable or independently verifiable behavior through every required layer.
2. Each task fits one fresh agent context and declares `Blocked by` edges. Work the frontier: tasks with no open blockers.
3. Put enabling prefactors first only when they make the behavior change materially easier.
4. Avoid horizontal tasks such as “add all models” or “write all tests.” The task owns its red → green tests and implementation together.
5. For a wide mechanical refactor that cannot land green as vertical slices, use expand → migrate batches → contract. The contract task is blocked by every migration batch.

Use this shape:

```markdown
- [ ] **Task 1.1**: Caller-visible outcome
  - Delivers: the end-to-end behavior that becomes usable
  - Files: expected areas, when known
  - Blocked by: none | task IDs
  - Acceptance: observable proof, including the focused Bun test
```

Before finalizing, present the numbered task graph and confirm granularity and blocking edges with the user. Do not duplicate the full design from the IP into tasks.

### Step 7: Acceptance criteria (optional)

- Parse the IP into testable outcomes.
- Add criteria covering happy path, edge/error paths, auth/permissions, data integrity, and regressions.
- Ensure testIDs required by criteria are explicitly called out.
- Keep criteria at public seams and describe observable behavior rather than internal calls.

### Step 8: E2E test planning/generation (optional)

- Read IP + acceptance criteria.
- Identify files to create.
- Identify missing `testID`s that must be added first.
- Generate Playwright plan/tests where requested.

### Step 9: Dual-model review (optional)

Run independent review passes (parallel) and merge findings:

- Identify issues by severity.
- Collect unresolved questions.
- Verify critical claims.
- Update IP with review log.

### Step 10: Attack and adjust (optional)

Stress-test assumptions, then tighten scope/plan before implementation.

Document what changed during attack (scope cuts, new risks, deferred work). **If Step 10 runs, you must continue to Step 11** before finalizing the IP for handoff.

### Step 11: Post-attack clarification (mandatory when Step 10 ran)

Run this step whenever Step 10 (Attack and adjust) was executed. If Step 10 was skipped, Step 11 is optional (skip or ask a single catch-all: any remaining ambiguities?).

1. Summarize attack outcomes: what was challenged, tightened, deferred, or newly exposed.
2. Emit numbered **blocking follow-up questions** raised by the attack pass (risk acceptance, sequencing, owner/product sign-off, cut-line for “not included,” technical bets).
3. Present options where tradeoffs remain — **do not** bake unresolved attack findings into the IP as silent decisions.
4. **Pause** for explicit user answers or named-assumption approval.
5. Only then update `docs/implementationPlans/` and `docs/tasks/` to match; if no file edits are needed, still confirm alignment in the thread before calling the plan final.

## Roadmap handoff (conditional)

Some repos run a public roadmap (GitHub Discussions + a roadmap Project + tracking
issues); others (for example Flourish and most consumer apps) do not. The **same
plugin must work in both**, so Blend detects the roadmap system and only hands off
when it is actually present. Blend never mutates GitHub itself — it hands off to
`roadmap-item`, which stops for maintainer approval.

### Detect first

Treat the repo as roadmap-enabled when **both** are true:

- `.github/roadmap-fields.yml` exists (the Project field taxonomy), and
- a `roadmap-item` skill is available in the workspace.

A quick check: `bun run roadmap:check` prints the valid options in a roadmap-enabled
repo and is absent otherwise.

### Roadmap-enabled repo (e.g. Terreno)

1. Do **not** open the tracking issue from Blend.
2. When the IP reaches **Approved**, hand off to `roadmap-item`:
   - If the work came from an accepted discussion, a `Shaping` tracking issue usually
     already exists (created by `roadmap-promote`). `roadmap-item` **updates** it —
     it sets the `IP` field to the IP slug and moves it `Shaping → Planned`. It does
     not open a second issue.
   - If no issue exists yet (internal-origin IP), `roadmap-item` creates one at
     `Planned`.
3. Write the resulting issue URL back into the IP header `Roadmap issue:` line.

### No-roadmap repo (e.g. Flourish, consumer apps)

1. Skip every roadmap step above — there is no board, no Discussions, and no
   `roadmap-item` skill to call.
2. The IP + task list are the source of truth (status on each IP's `**Status:**` header).
   Track sprint execution in Linear and record it on the IP header `Linear:`
   line; never copy the design into the tracker.
3. Do not fabricate roadmap labels, fields, or issues. If a maintainer later adds the
   roadmap system, re-run this handoff.

If detection is ambiguous, say so and ask rather than guessing — do not create a
roadmap issue in a repo that has no roadmap.

## Lifecycle Operations

Support the existing lifecycle commands from legacy `/ip`:

- `Init` (tracking files, template, conventions)
- `Explore` (parallel context gathering)
- `Deep Analysis` (multi-angle investigation + synthesis)
- `Status` (IP-header/task progression view)
- `Close` (archive/commit housekeeping)

### Lifecycle: Init

Initialize IP tracking in the current project root.

1. Infer project context from `CLAUDE.md`, language/tooling files, and existing `docs/implementationPlans/` files.
2. Create the standard structure:
   - `docs/implementationPlans/archive/`
   - `docs/tasks/`
3. Do **not** create `docs/implementationPlans/PLAN_INDEX.md`. If a leftover index exists, delete it. Status lives on each IP's `**Status:**` header.
4. Ensure `docs/implementationPlans/IP_TEMPLATE.md` exists with the full legacy IP section layout and task-list scaffold.
5. Ensure project `CLAUDE.md` includes IP lifecycle conventions (statuses, numbering, archive rules, `%%` annotation behavior).
6. Print an init summary listing created/updated files and next actions.

### Lifecycle: Explore

Run parallel context gathering and synthesize one briefing.

1. Launch three parallel explore passes:
   - Project overview (docs, layout, stack, gotchas)
   - IP history (each IP's `**Status:**` header, archive, tasks, recent `IP-` commits)
   - Recent activity (recent commits, changed files, branch state, uncommitted work)
2. Merge the outputs into a single briefing containing:
   - Project overview
   - IP status and active task progress
   - Recent activity snapshot
   - Quick-reference table (project, branch, active IP count, active task count, recent focus)

### Lifecycle: Deep Analysis

Run a multi-angle deep analysis and produce a verified synthesis.

1. Parse the problem and gather minimal starter context.
2. Define four distinct analysis angles (non-overlapping lenses).
3. Launch four parallel explore agents, one per angle.
4. Verify key claims before final recommendation:
   - Identify and resolve contradictions between agent reports.
   - Spot-check the highest-impact factual claims directly in code/docs.
5. Produce a synthesis with agreements, tensions, surprises, corrections, recommendation, assumptions, and immediate next step.

### Lifecycle: Status

Report current IP state with optional grooming.

1. Fast path (when state is known-fresh): read each IP file's `**Status:**` header (skip `README.md` and `IP_TEMPLATE.md`), then print the status table.
2. Full grooming (when state may be stale):
   - Treat each IP file's `**Status:**` as the source of truth.
   - Archive non-archived IPs already marked Complete/Deferred/Closed.
   - Compute task progress (`completed/total`) from corresponding `docs/tasks/` files.
3. Output a concise Active Plans table and totals.

### Lifecycle: Close

Close a single IP and keep files consistent.

1. Resolve the target IP from explicit argument or clear conversation context.
2. Update the IP file status to one of `Complete`, `Closed`, or `Deferred` and add completion/closed date metadata.
3. Archive the IP file under `docs/implementationPlans/archive/` (and associated task file when applicable).
4. Produce a close summary with disposition and file moves. Do not maintain `PLAN_INDEX.md`.

## Conventions

- Keep inline annotations (`%%`) behavior for user-provided instructions in plan/task artifacts.
- Preserve MCP/Linear/tool references already present in existing workflows.
- Keep recommendations opinionated and evidence-based **after** the clarification pass; during research and Step 3, frame strong takes as options to choose from, not as the committed plan. The same applies after Step 10 until Step 11 is complete: attack may surface new choices — ask, do not assume.
