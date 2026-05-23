# Implementation Plan: Offline Mode

**Status:** Placeholder
**Priority:** TBD
**Effort:** TBD

*This placeholder reserves the offline-mode planning surface. Before implementation begins, replace TBD sections with the shaped design, get engineering feedback, and tag Josh with the @ symbol for review.*

## Context

Terreno already has initial offline primitives in `@terreno/rtk`, including `offlineSlice`, `offlineMiddleware`, `useOfflineStatus`, and `useServerStatus`. This IP should decide whether offline mode means polishing those primitives, adding UI components around them, integrating them into the example app, or expanding backend conflict support.

## Models

TBD.

Questions to answer:
- Do queued mutation records need durable storage beyond Redux persistence?
- Do conflict records need a server-side representation or are local-only records enough?
- Are per-model sync metadata fields required, or can existing `created` and `updated` timestamps support conflict detection?

## APIs

TBD.

Questions to answer:
- Which APIs must support offline mutation replay?
- Should modelRouter expose a standard conflict response when `If-Unmodified-Since` or equivalent precondition checks fail?
- Is a generic sync/status endpoint needed, or should apps rely on existing health checks?

## Notifications

TBD.

Likely candidates:
- In-app banner while offline.
- In-app sync progress indicator while queued mutations replay.
- Conflict notification when a queued mutation cannot be applied cleanly.

## UI

TBD.

Potential surfaces:
- Reusable offline banner in `@terreno/ui`.
- Example frontend integration using `useServerStatus`.
- Conflict list/resolution UI for queued mutation failures.

## Phases

TBD.

Suggested starting breakdown:
1. Research existing offline primitives and test coverage.
2. Shape the minimum framework API for app teams to enable offline mode.
3. Add examples and documentation once the API surface is confirmed.

## Feature Flags & Migrations

TBD.

Consider whether offline mode should be opt-in at the app/store level and whether any queue persistence migration is needed for existing consumers.

## Activity Log & User Updates

TBD.

Clarify whether replayed mutations should create normal activity log entries, special "synced from offline" entries, or no additional audit metadata.

## Not Included / Future Work

TBD.

Potential exclusions:
- Full collaborative conflict resolution.
- Background sync while the app is closed.
- Binary/file upload offline queues.

## Acceptance Criteria

Placeholder. Replace with concrete acceptance criteria after the full offline-mode scope is shaped.

---

## Task List (Bot Consumption)

*Structured task breakdown placeholder. Expand into implementation tasks after research and shaping.*

### Phase 0: Plan Completion

- [ ] **Task 0.1**: Research existing offline-mode implementation
  - Description: Review `rtk/src/offlineSlice.ts`, `rtk/src/offlineMiddleware.ts`, `rtk/src/useOfflineStatus.ts`, `rtk/src/useServerStatus.ts`, related tests, and any example app usage.
  - Files: `rtk/src/*offline*`, `rtk/src/useServerStatus.ts`, relevant tests and docs
  - Depends on: none
  - Acceptance: Research notes identify current capabilities, gaps, and risky assumptions.

- [ ] **Task 0.2**: Shape offline-mode scope
  - Description: Decide the intended product/API scope for offline mode, including queue persistence, replay semantics, conflict handling, UI surfaces, and example app integration.
  - Files: `docs/implementationPlans/offline-mode.md`
  - Depends on: Task 0.1
  - Acceptance: This placeholder IP is replaced with a concrete implementation plan.

- [ ] **Task 0.3**: Generate implementation tasks
  - Description: Create the final bot-consumable task list once the implementation plan is approved.
  - Files: `docs/tasks/offline-mode.md`
  - Depends on: Task 0.2
  - Acceptance: Task list is specific enough for implementation agents to execute independently.
