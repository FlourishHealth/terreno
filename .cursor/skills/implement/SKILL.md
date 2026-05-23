---
name: implement
description: Test-driven implementation execution skill for applying implementation plans directly in code
---
# Implementation Execution Skill

Use this skill when an Implementation Plan (IP) or implementation requirements are provided.


The goal of this skill is to execute the implementation directly in code using test-driven development.

If the implementation plan is incomplete or contains contradictions, highlight the conflicts and request clarification before proceeding.

Do not stop after analysis or task generation unless blocked by material ambiguity.

## Primary Behavior

When an IP is provided:

1. Read the full IP carefully.
2. Determine implementation scope.
3. Identify the smallest meaningful automated test coverage that should fail for the requested behavior.
4. Write or update the failing tests before implementation code.
5. Run the targeted tests and confirm they fail for the expected product reason, not because of syntax, setup, or unrelated failures.
6. Implement the requested changes directly.
7. Run the previously failing tests until they pass.
8. Run relevant validation or broader test commands when available.
9. Summarize completed work, assumptions, and remaining risks.

Exclude generating a separate implementation plan unless explicitly requested.

## Scope Detection

Determine whether the implementation is:

- backend only
- frontend only
- full stack
- phased implementation
- rollout-gated
- migration-dependent


// --- Assumption Rules ---
Use best-effort assumptions when the assumption does not affect compliance, data integrity, or user experience.

If the correct scope is unclear and could materially change implementation, ask concise clarifying questions before coding.

## Clarifying Question Rules

Only ask questions if missing information would materially affect:

- architecture
- data model behavior
- API contracts
- permissions/access control
- user/admin visibility
- rollout sequencing
- migration/backfill behavior
- destructive operations
- compliance-sensitive behavior
- whether implementation should be backend only, frontend only, phased, or full stack

// --- Clarifying Question Exclusions ---
Exclude asking questions for implementation details that do not affect functionality, performance, or compliance, and can reasonably be inferred.


## Execution Expectations

Implement the requested behavior directly in the codebase.

### Test-Driven Development Flow

Default to red/green/refactor:

- red: write the focused failing test or regression test first
- green: implement only enough production code to satisfy the requested behavior
- refactor: clean up the implementation while preserving passing tests

If no meaningful automated test can be written for the change, document why before implementation and use the strongest available manual or static validation instead.

### Implementation Steps
- update or add focused failing tests
- update schemas/models
- update services/controllers/routes
- update validation
- update frontend UI
- update state management/API hooks
- update OpenAPI/types
- update permissions/visibility logic
- update feature flags
- update fixtures/mocks
- rerun the focused tests that failed first
- run broader validation when appropriate
- preserve existing behavior unless the IP explicitly changes it

## Phased Implementations

If the IP implies phased implementation:

- determine whether backend and frontend should be separated
- determine whether rollout gating is required
- determine whether app-version compatibility matters

If phase requirements are unclear and could affect implementation safety, ask before coding.

Otherwise proceed with best-effort assumptions.

## Testing Requirements

Add or update relevant tests before production implementation whenever applicable.

Possible test types include:

- backend unit tests
- backend integration tests
- API tests
- frontend component tests
- frontend flow tests
- regression tests

Run the most targeted available tests first and capture the initial failure before writing production code. After implementation, rerun the same focused tests to confirm the red-to-green transition.

If full test execution is not practical, run the closest focused validation possible and document what was not run.

## File Modification Rules

Prefer modifying existing patterns consistently with the codebase.

Avoid introducing new architectural patterns unless required.

Do not invent exact file paths unless strongly implied by the repository structure.

Prefer consistency over novelty.

## Safety Rules

Do not make destructive or irreversible changes without clear instruction.

Do not silently change existing product behavior outside the requested scope.

If implementation could create compliance, privacy, permission, or rollout risk, explicitly call it out in the final response.

## Final Response Requirements

At completion, summarize:

- implementation scope
- major code changes
- assumptions made
- tests updated/run
- remaining risks or follow-up work

Keep the summary concise and implementation-focused.
