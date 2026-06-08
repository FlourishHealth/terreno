---
name: blend
description: Use ONLY when a concrete spec/Linear ticket/feature request must be converted into an Implementation Plan document. Do NOT use for code implementation, PR submission, or post-PR review handling.
disable-model-invocation: true
---

# Blend

Turn a raw request into an Implementation Plan (IP) using the existing `/ip` structure and lifecycle.

## Overview

- Output is the IP document (plus optional acceptance criteria and optional E2E test scaffolding when requested).
- Keep scope bounded and explicit.
- Preserve existing project conventions, tool usage, and repository patterns.

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

- `$PRD` is required for `/blend` when invoked as plan-from-text/file.
- If `$PRD` is missing, stop immediately and return: `Error: /blend requires a PRD as the first argument (either a file path or inline PRD text). Please re-run as /blend <path-or-text>.`
- Accept file path or inline text.
- Summarize problem, business impact, stakeholders, constraints.
- Ask for confirmation before research.

### Step 2: Research context

Produce a complete research artifact before shaping:

1. Scope statement and what will be investigated.
2. Deep codebase read (models/routes/screens/components/tests/docs/rules).
3. External research for APIs/libraries/best practices.
4. Findings document with summary, options, recommendation, open questions, references.
5. Iterate with user feedback.
6. Save final research as `research.md`.

### Step 3: Shape and question

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

### Step 4: Plan sections (optional deep pass)

Deepen any section as needed:

1. Models
2. APIs
3. Notifications
4. UI
5. Phases
6. Feature flags and migrations
7. Activity log and user updates
8. Not included / future work

### Step 5: Generate IP output

Write the final IP with the same structure used by legacy `/ip`:

- Models
- APIs
- Notifications
- UI
- Phases
- Feature flags & migrations
- Activity log & user updates
- Not included / future work
- Task list grouped by phase

Persist planning artifacts in the standard repo paths:

- Save the final IP document under `docs/implementationPlans/`.
- Save the executable task breakdown under `docs/tasks/`.

### Step 6: Acceptance criteria (optional)

- Parse the IP into testable outcomes.
- Add criteria covering happy path, edge/error paths, auth/permissions, data integrity, and regressions.
- Ensure testIDs required by criteria are explicitly called out.

### Step 7: E2E test planning/generation (optional)

- Read IP + acceptance criteria.
- Identify files to create.
- Identify missing `testID`s that must be added first.
- Generate Playwright plan/tests where requested.

### Step 8: Dual-model review (optional)

Run independent review passes (parallel) and merge findings:

- Identify issues by severity.
- Collect unresolved questions.
- Verify critical claims.
- Update IP with review log.

### Step 9: Attack and adjust (optional)

Stress-test assumptions, then tighten scope/plan before implementation.

## Lifecycle Operations

Support the existing lifecycle commands from legacy `/ip`:

- `Init` (tracking files, template, conventions)
- `Explore` (parallel context gathering)
- `Deep Analysis` (multi-angle investigation + synthesis)
- `Status` (index/task progression view)
- `Close` (archive/update index/commit housekeeping)

## Conventions

- Keep inline annotations (`%%`) behavior for user-provided instructions in plan/task artifacts.
- Preserve MCP/Linear/tool references already present in existing workflows.
- Keep recommendations opinionated and evidence-based.
