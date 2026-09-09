# Task List: Examples, Demo, and Test Coverage

See: [`docs/implementationPlans/examples-demo-coverage.md`](../implementationPlans/examples-demo-coverage.md)

**RTK deprecation flag:** **Partial.** Tasks marked `[RTK]` touch the example apps' data layer and must wait for PR #869. Demo-app and coverage-infrastructure tasks are `@terreno/ui`-only or CI-only and are safe to implement now.

## Instructions for the implementing agent

- Derive the missing-component list from `ui/src/index.tsx` at implementation time. The list in the IP is a snapshot and will be stale.
- When a component turns out to be hard to demo because of a bug, fix the bug and note it — that is a valuable side effect of this work, not a distraction.
- Per IP decision E4, enforce the existing 95% threshold immediately. Packages below threshold must catch up before CI passes — do not introduce a ratchet floors file.
- Follow the existing story conventions: read several files in `demo/stories/` first and match their structure, and use only `@terreno/ui` components inside stories.
- Run `bun run lint`, `bun run demo:compile`, and `bun run ui:test` before each commit.

## Phase 1: Demo coverage — audit and P0

- [ ] **Task 1.1**: Audit demo story coverage
  - Description: Extract the list of components exported from `ui/src/index.tsx`. Extract the list of components registered in `demo/demoConfig.tsx`. Produce the difference. Classify each missing component as P0 (demonstrates a pillar: AI, auth, responsive layout), P1 (common in real apps), P2 (uncommon), or "cannot be demoed in isolation" with a reason. Report the full table in the PR body.
  - Files: none (findings in the PR body)
  - Depends on: none
  - Acceptance: the table is derived from the two actual source files; every missing component has a classification; every "cannot be demoed" entry has a stated reason.

- [ ] **Task 1.2**: Add P0 stories
  - Description: Write stories for every P0 component from Task 1.1 (expected to include `GPTChat`, `SocialLoginButton`, and `SplitPage` — confirm against the audit). Each story shows multiple states where the component supports them: default, loading, error, disabled, and any variant enumerations. `GPTChat` needs a story that works without a live backend — use a static message list rather than wiring a real AI call. `SocialLoginButton` needs all three providers and both variants. `SplitPage` needs a story demonstrating the responsive breakpoint behavior. Register each in `demoConfig.tsx`.
  - Files: `demo/stories/*.stories.tsx` (new), `demo/demoConfig.tsx`
  - Depends on: Task 1.1
  - Acceptance: every P0 component has a story reachable in the running demo (`bun run demo:start`, port 8085); each shows at least two states; `GPTChat`'s story renders with no backend running; `bun run demo:compile` passes.

- [ ] **Task 1.3**: Add the demo coverage check
  - Description: Create `scripts/check-demo-coverage.ts` (Bun, TypeScript, `const` arrow functions with explicit return types). It parses the export list from `ui/src/index.tsx` and the registered components from `demo/demoConfig.tsx`, then fails with a list of unstoried components. Support an allowlist file or an in-script allowlist where each entry requires a comment explaining why the component cannot be demoed. Add a `check:demo-coverage` script to the root `package.json` and wire it into `.github/workflows/ui-demo-ci.yml`.
  - Files: `scripts/check-demo-coverage.ts` (new), `package.json`, `.github/workflows/ui-demo-ci.yml`
  - Depends on: Task 1.2
  - Acceptance: the check passes with the current allowlist; adding a new export to `ui/src/index.tsx` without a story makes it fail and name the component; the CI job runs it.

- [ ] **Task 1.4**: Make the demo's `test:ci` real
  - Description: `demo/package.json`'s `test:ci` is currently `echo 'No tests'`. Replace it with something meaningful: at minimum a smoke test that every registered story renders without throwing, using the `renderWithTheme` helper from `@terreno/ui`'s test utilities. This catches the most common demo breakage — a story that crashes after a component's props change.
  - Files: `demo/package.json`, `demo/**` test files (new)
  - Depends on: Task 1.2
  - Acceptance: `bun run --filter 'terreno-demo' test:ci` runs real tests and passes; deliberately breaking one story's props makes it fail; the test iterates the registered stories rather than a hardcoded list.

## Phase 2: Remaining demo stories

- [ ] **Task 2.1**: Add P1 stories
  - Description: Write stories for every P1 component from the Task 1.1 audit (expected to include `ActionSheet`, `ModalSheet`, `FilePickerButton`, and `Image`). Interactive components need a story that can actually be triggered from the demo UI, not just a static render. Register each in `demoConfig.tsx`.
  - Files: `demo/stories/*.stories.tsx` (new), `demo/demoConfig.tsx`
  - Depends on: Task 1.3
  - Acceptance: every P1 component has a story; interactive components can be opened and dismissed in the running demo; `bun run demo:compile` passes.

- [ ] **Task 2.2**: Add P2 stories and close the allowlist
  - Description: Write stories for the remaining P2 components. For any component that genuinely cannot be demoed in isolation, add it to the allowlist with a specific reason (not "hard to demo"). The goal is an empty or near-empty gap list with a justified allowlist.
  - Files: `demo/stories/*.stories.tsx` (new), `demo/demoConfig.tsx`, the allowlist
  - Depends on: Task 2.1
  - Acceptance: `bun run check:demo-coverage` passes with no unstoried, unallowlisted components; every allowlist entry has a specific reason.

## Phase 3: Coverage enforcement

- [ ] **Task 3.1**: Measure current coverage per package
  - Description: Run every published package's `test:coverage` on a clean `master` and record the actual coverage. Report which packages are below the 95% threshold in the PR body. This is a planning step — do not lower the threshold or add exemptions.
  - Files: none (findings in the PR body)
  - Depends on: none
  - Acceptance: every published package has a measured coverage value; packages below 95% are listed with their gap.

- [ ] **Task 3.2**: Wire the threshold into every package CI
  - Description: Add `scripts/check-coverage.ts` (default 95% threshold) to every published package's CI — either the existing dedicated workflow or the new matrix job from Task 3.3. Packages below threshold when this lands will fail CI until catch-up work merges; track that in the implementation PR.
  - Files: `.github/workflows/ui-ci.yml`, `ai-ci.yml`, `admin-spa-ci.yml`, `.github/workflows/packages-ci.yml`, package `package.json` files as needed
  - Depends on: Task 3.1
  - Acceptance: every published package's CI runs the coverage check at 95%; no package has a permanent exemption.

- [ ] **Task 3.3**: Add the matrix CI job for uncovered packages
  - Description: Per IP question E3, create `.github/workflows/packages-ci.yml` with a matrix over the published packages that lack a dedicated workflow (`admin-backend`, `feature-flags`, `api-health`, `test` — verify the current set against `.github/workflows/`). Each matrix entry runs compile, lint, tests, and the coverage check. Use path filters so the job only runs for the affected package where practical. Follow the repo's required-input validation convention.
  - Files: `.github/workflows/packages-ci.yml` (new)
  - Depends on: Task 3.2
  - Acceptance: the workflow parses as valid YAML; the matrix covers exactly the published packages without their own workflow; each entry runs compile, lint, test, and coverage at 95%.

- [ ] **Task 3.4**: Catch up packages below threshold
  - Description: For each package measured below 95% in Task 3.1, add tests until `scripts/check-coverage.ts` passes. This may be a separate PR if the gap is large; do not merge the CI wiring until every package passes or the IP owner explicitly defers a package with a linked issue.
  - Files: package test files as needed
  - Depends on: Task 3.2
  - Acceptance: `bun run check-coverage` (or per-package equivalent) passes at 95% for every published package.

## Phase 4: Codecov

- [ ] **Task 4.1**: Configure Codecov
  - Description: Add `codecov.yml` configuring per-package flags so each package's coverage is reported separately, a target of "auto" with a small allowed threshold so trivial deltas do not fail PRs, and comment settings that post the delta on pull requests. Add the upload step to every package CI workflow. Note in the file where the `CODECOV_TOKEN` secret must be configured (a maintainer action for a public repo, though public repos often need no token — verify current Codecov requirements before documenting).
  - Files: `codecov.yml` (new), every package CI workflow
  - Depends on: Task 3.4
  - Acceptance: `codecov.yml` is valid; every package workflow uploads with a distinct flag; the token requirement is documented accurately for a public repo.

- [ ] **Task 4.2**: Add the coverage badge
  - Description: Add a Codecov badge to `README.md` next to the existing npm and license badges. Add a "Testing and coverage" section to `CONTRIBUTING.md` explaining: the 95% coverage expectation for new code, that coverage must not drop in a PR, and how to run coverage locally per package.
  - Files: `README.md`, `CONTRIBUTING.md`
  - Depends on: Task 4.1
  - Acceptance: the badge renders and reflects real coverage; the contributing section explains the 95% threshold and gives the local command.

## Phase 5: Example feature matrix

- [ ] **Task 5.1**: `[RTK]` Audit example app feature coverage
  - Description: Build the capability matrix from the IP by reading `example-backend/src/` and `example-frontend/app/`. Resolve every `?`: does an example actually exercise AI structured output, Better Auth, and (after #869) syncdb local-first behavior? For each capability, cite the file that exercises it or record it as a gap. Include capabilities that are not shipped (RBAC, background jobs) marked as such with links to their IPs.
  - Files: `docs/explanation/example-coverage.md` (new)
  - Depends on: PR #869 merged
  - Acceptance: no `?` remains; every "yes" cites a file path; every gap is explicit; unshipped capabilities link their IPs.

- [ ] **Task 5.2**: `[RTK]` Fill the highest-value example gaps
  - Description: For each gap found in Task 5.1, either add the example or record it as a known gap with an issue. Prioritize capabilities the launch documentation depends on — if a tutorial or reference page describes something with no working example, that is the highest priority because the docs claim will be tested by readers. Do not add examples for unshipped features.
  - Files: `example-backend/src/**`, `example-frontend/app/**`, `docs/explanation/example-coverage.md`
  - Depends on: Task 5.1
  - Acceptance: every gap that a launch document depends on is filled with a working example; remaining gaps are recorded with issue links; both example apps still pass their CI.

- [ ] **Task 5.3**: Link the matrix into the contribution process
  - Description: Add a note to `CONTRIBUTING.md` and the PR template: when adding a framework capability, add or update the example that exercises it and update `docs/explanation/example-coverage.md`. This is what keeps the matrix true. Link the matrix from `docs/explanation/README.md`.
  - Files: `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/explanation/README.md`
  - Depends on: Task 5.1
  - Acceptance: both the contributing guide and the PR template reference the requirement; the matrix is linked from the explanation index.
