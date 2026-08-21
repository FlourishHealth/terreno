---
name: terreno-2-roast
description: Implement an approved IP in code via strict TDD with independent review checkpoints and drift detection. Use ONLY when an approved IP exists — not for creating IPs, opening PRs, or monitoring CI/review comments after a PR is open.
---

# Roast

Implement from an IP using strict vertical-slice TDD, with independent review checkpoints and drift detection at every commit. Load [`references/testing.md`](references/testing.md) before choosing test seams and [`references/mocking.md`](references/mocking.md) whenever a test double is considered.

## Preconditions

- An approved IP/spec exists.
- Scope is implementation, not planning or PR operations.

## Execution Model

- Follow red -> green (`Specify -> Encode -> Fulfill`) one behavior at a time.
- Use tracer-bullet vertical slices. Each cycle proves a narrow complete behavior through its public seam; never write all tests first and implementation later.
- Refactor only after the coherent slice is green and independently reviewed.
- Keep commits small and behavior-scoped.
- After each commit, verify the branch still matches the IP. If drift is found, stop and surface mismatch before continuing.

## Mandatory Independent Reviews

At meaningful checkpoints (minimum: after each commit):

1. Spawn an independent review sub-agent in a fresh context to assess code correctness and IP alignment.
2. Spawn a separate independent test-quality sub-agent in its own fresh context before trusting test coverage.

If either sub-agent flags issues, fix and rerun review before continuing.

## Test-Quality Audit Rules (strict)

The test-quality sub-agent must enforce all of these:

- Test caller-visible behavior through public seams, not private methods or internal call order.
- Derive expected values from the IP or a worked literal, not the production algorithm.
- Prefer injected typed fakes at external boundaries.
- Treat `mock.module` as process-global and leaky. Do not use module-level mocks in normal suites.
- When an unchangeable dynamic import requires `mock.module`, isolate the file in its own Bun process and document why injection is impossible.
- Keep spies and fakes scoped to the test or a fresh harness factory.
- Never mock the database on the backend.
- Use real frontend stores/reducers/providers; inject only network, storage, clock, or other external adapters.

## TDD Cycle

### 1) Specify

Define one caller-visible behavior in plain language. Record the highest existing public seam that proves it.

### 2) Encode

Write exactly one failing test for that behavior. Run the closest Bun command with `--only-failures` and verify it is red for the expected product reason, not syntax, setup, or an unrelated failure.

### 3) Fulfill

Implement the minimum code required to pass that test.

Repeat Specify → Encode → Fulfill for the next learned behavior. Do not prewrite a horizontal batch of tests.

### 4) Review and Clean the Kitchen

After a coherent vertical slice is green:

1. Run the independent correctness and test-quality reviews.
2. Refactor safely, remove dead/debug code, and improve names without adding behavior.
3. Rerun the slice tests in agent-quiet mode.
4. Commit only when the reviewed slice stays green and matches the IP.

## Before Coding a Slice

- Consider multiple approaches (legacy behavior: brainstorm alternatives first).
- Choose the best approach and proceed with smallest safe increment.

## Package/Domain Guardrails

### General

- Use Bun workflows (`bun run lint`, `bun run compile`, targeted `bun test --only-failures ...`).
- Prefer real integrations over heavy mocking.
- Preserve repo coding conventions (TypeScript patterns, error handling, logging rules, Luxon requirement where relevant).

### Backend (`@terreno/api`, backends)

- Use real test DB patterns and route-level tests where appropriate.
- Never use raw `Model.findOne`; use `findExactlyOne`/`findOneOrNone` patterns.
- Apply schema-safety checks for any model change (types, indexes, migration/backfill risks, cross-package ripple).

### Backend tests mutating env

When tests mutate `process.env`, follow the backend env contract:

- Treat the package preload `beforeEach` as the baseline reset source of truth.
- Mutate only the keys needed by the test; do not use whole-env snapshot/restore patterns.
- Do not add redundant manual restore for keys the preload already resets.
- Use `Reflect.deleteProperty(process.env, "KEY")` when a key must be unset.
- Ensure newly required keys are added to shared setup paths (`setupEnvironment()` and relevant preload setup files).

### AI prompt changes (`@terreno/ai`)

When adding/changing prompts:

- Keep prompts in constants.
- Use approved temperature presets.
- Preserve logging and prompt-test checklist requirements.

### Backend API surface changes

If backend API shape changes, regenerate SDK via the established workflow:

- Start backend
- Run frontend SDK generation
- Never hand-edit `example-frontend/store/openApiSdk.ts`

### Frontend changes (mandatory)

When implementation touches frontend packages (`ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, or app-integrated `rtk/`):

1. Before marking roast complete and handing to Pour, invoke the `verify-ui-changes` skill.
2. Launch the correct app for the package that changed.
3. Log in with seeded credentials when the app requires authentication.
4. Attempt to use each implemented user-facing feature — navigate to the affected screen and exercise the primary flow.
5. Save screenshots and videos under `/opt/cursor/artifacts/` for Pour to attach to the PR.

Do not hand off to Pour without this evidence when frontend paths changed, unless environment setup is genuinely blocked (document the blocker and commands attempted).

## Per-Commit Verification Checklist

For every commit:

1. Confirm changed behavior maps to IP tasks/criteria.
2. Run targeted tests with Bun `--only-failures` and required lint/compile checks.
3. When the commit touches frontend paths, run `verify-ui-changes` (launch app, login, exercise feature, save screenshots/videos).
4. Run independent code review sub-agent.
5. Run independent test-quality sub-agent.
6. Proceed only if alignment + quality checks pass.

## Done Criteria for Roast

- All planned implementation tasks for the scoped slice are complete.
- Tests prove behavior through public seams and comply with [`references/testing.md`](references/testing.md).
- Test doubles comply with [`references/mocking.md`](references/mocking.md); no leaky module-level mocks were introduced.
- Frontend paths have app login + feature verification evidence saved to `/opt/cursor/artifacts/` when applicable.
- No unresolved review findings remain from independent sub-agents.
- Work is ready for **Pour** (`plugins/terreno-planning/skills/terreno-4-pour/SKILL.md`).
