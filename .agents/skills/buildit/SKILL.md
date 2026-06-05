---
name: buildit
description: >-
  Test-driven implementation — specify behavior as tests first, fulfill one test
  at a time, clean the kitchen between cycles. TypeScript/Bun tooling for the
  Terreno monorepo. Use /buildit when implementing features from a plan or PRD.
---
# Build It

Test-driven development (TDD) workflow for implementing features. Based on the Canon TDD
cycle (specify → encode → fulfill) adapted for TypeScript, Bun, and the Terreno monorepo.

## When to Use

- Implementing a feature from an implementation plan (`/ip`) or PRD
- Bug fixes where a regression test should be written first
- Any new behavior that can be expressed as a testable specification

## Do Not Use When

- Pure documentation or config-only changes with no testable behavior
- Exploratory spikes where the API shape is unknown — prototype first, then `/buildit`
- Shipping to PR → use `/shipit` after buildit is complete

## The Canon TDD Cycle

Three phases, repeated for **each** test:

```
Specify → Encode → Fulfill → (clean kitchen) → next test
```

### 1. Specify

Describe the desired behavior in plain language before writing any code.

- What should happen when the user does X?
- What error should be thrown when Y is invalid?
- What edge cases matter?

Write this as a comment block or plan bullet — not code yet.

### 2. Encode

Write **one** failing test that captures the specification.

Rules:
- Exactly one new test per cycle
- The test must fail for the right reason (missing behavior, not a typo)
- Run the test and confirm it fails before moving on

### 3. Fulfill

Write the **minimum** implementation code to make that single test pass.

Rules:
- Do not implement behavior for tests you haven't written yet
- Do not refactor beyond what the current test requires
- Run the test and confirm it passes

### 4. Clean the Kitchen

After each fulfill cycle, clean up before the next test:

- Remove dead code introduced during exploration
- Rename poorly named variables/functions
- Extract helpers only when duplication appears across 2+ tests
- Ensure lint passes on changed files

Then return to **Specify** for the next behavior.

## TypeScript / Bun Tooling

Adapted from Python TDD practices for this monorepo:

### Environment and execution

- Use **Bun** as the package manager and test runner (`bun test`)
- Run tests from the relevant package directory or via root scripts:
  - `bun run api:test` — `@terreno/api`
  - `bun run ui:test` — `@terreno/ui`
  - Package-local: `cd api && bun test src/path/to.test.ts`

### Testing conventions

- Use `bun test` with `expect` for assertions (repo standard)
- In packages that use chai: use `assert` rather than `expect` (per project rules)
- Collect shared fixtures in package-level setup files (e.g. `api/src/tests/bunSetup.ts`) — avoid duplicating setup across test files
- Prefer testing **real code** — real database (in-memory Mongo), real routers, real components
- Use doubles and spies only when interfacing with external systems (network, third-party APIs, time)
- Avoid excessive mocking — if you need many mocks, reconsider the design
- When a test fails, re-run the last failed test first:
  ```bash
  bun test --last-failed
  ```

### Code quality

- Run **Biome** lint on changed files: `bun run lint` (or package-scoped lint)
- Run **compile** after type changes: `bun run compile`
- Don't edit `package.json` dependencies casually — use `bun add` / `bun add -d` from the correct package directory
- Don't use excessive casting — if you cast frequently, refactor types at the boundary
- Use type annotations on all function parameters and return types

### Logging and debugging

- Backend (`@terreno/api`, backends): `logger.info`, `logger.warn`, `logger.error`, `logger.debug`
- Frontend: `console.info`, `console.debug`, `console.warn`, `console.error` for permanent logs
- Use `console.log` only for temporary debugging — remove before committing
- Don't use logging to hide stack traces

### Regression prevention

- When you encounter a bug, write a failing test that reproduces it **first**
- Then fix the code
- Think about how to prevent the class of bug (validation, types, guard clauses)

## Before You Code: Five Approaches

Before implementing, brainstorm **5 different approaches** to solve the problem.
Sort them by probable effectiveness. Choose the best one. Document the choice briefly
in a comment or plan update if non-obvious.

## TDD Workflow by Package

### @terreno/api (backend)

```bash
cd api
bun test src/tests/path/toFeature.test.ts   # single file while iterating
bun test --last-failed                       # after a failure
```

Patterns:
- Use in-memory Mongo via test setup helpers
- Test routes with `supertest` or the package's test harness
- Throw `APIError` with appropriate status codes
- Use `Model.findExactlyOne` / `Model.findOneOrThrow` — not raw `findOne`

### @terreno/ui (components)

```bash
cd ui
bun test src/ComponentName.test.tsx
```

Patterns:
- Render with `@testing-library/react-native`
- Test user-visible behavior, not implementation details
- Wrap in `TerrenoProvider` when theme-dependent

### example-backend / example-frontend

- Keep examples updated when adding framework features
- After backend API changes: regenerate SDK (`/generate-sdk`)
- Verify integration by running both examples

## Implementation Plan Integration

When working from an `/ip` plan:

1. Read the plan's task list
2. For each task, break behavior into testable specifications
3. Run the Canon cycle for each specification (one test at a time)
4. Mark plan tasks complete only when tests pass and kitchen is clean
5. When all tasks done → `/shipit`

## Checklist Per Feature

- [ ] Behavior specified in plain language before each test
- [ ] One failing test written and confirmed failing
- [ ] Minimum code to pass — test confirmed passing
- [ ] Kitchen cleaned (dead code, names, lint)
- [ ] `bun run lint` passes on touched packages
- [ ] `bun run compile` passes if types changed
- [ ] All new tests pass in CI scope (`api:test`, `ui:test`, etc.)
- [ ] No `console.log` left from debugging

## Anti-Patterns

| Anti-pattern | Instead |
|---|---|
| Writing all tests upfront | One test per cycle |
| Implementing ahead of tests | Fulfill only the current failing test |
| Large untested commits | Small commits per passing test |
| Mocking everything | Test real code; mock only external boundaries |
| Skipping "clean kitchen" | Refactor each cycle before the next test |
| `@ts-ignore` to make tests pass | Fix the types |

## Related Skills

- `/ip` — create an implementation plan before buildit
- `/shipit` — commit, PR, CI, and bot review after buildit
- `/generate-sdk` — regenerate frontend SDK after backend API changes
- `/backend-test-env` — env mutation patterns for api tests
- `/mongoose-schema-safety` — schema change checklist
- `/ai-prompt-governance` — when adding AI prompts
- `/verify-ui-changes` — visual/manual UI validation
