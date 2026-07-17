# Implementation Plan: SyncDB Local-First Data Layer

**Status:** Drafted from PRD
**Priority:** High
**Effort:** Large

## Context

`@terreno/rtk` currently provides RTK Query primitives (auth slice, base API, offline queue/middleware, realtime cache patching). The requested direction is to replace it with a local-first package where the browser-local database is the primary UI source of truth, mutations apply locally first, and server communication is asynchronous reconciliation via websocket deltas.

The replacement must focus on:

- local database-first reads,
- local mutation durability and replay,
- websocket-based delta sync,
- encryption at rest for IndexedDB using Web Crypto,
- no bundling/chunking optimization work in this phase.

## Core Concept

Build a new package, `@terreno/syncdb`, that supersedes `@terreno/rtk` for data synchronization concerns. The app reads from an encrypted local entity store (IndexedDB + in-memory cache), writes optimistically to local state and durable outbox first, and then syncs to the server over websocket/HTTP acknowledgement channels.

Server remains source of truth for final validation and authorization, but **not** the source for immediate UI responsiveness.

## Models

No new backend Mongoose models are required in v1. Core state models are client-side storage schemas inside `@terreno/syncdb`.

### Client local storage schema (IndexedDB)

```typescript
interface LocalEntityRecord {
  key: string; // `${collection}:${id}`
  collection: string;
  id: string;
  // encrypted payload envelope
  payloadCiphertext: ArrayBuffer;
  iv: Uint8Array;
  keyId: string;
  aadVersion: number;
  updatedAt: string; // ISO from server/version metadata
}

interface LocalOutboxMutation {
  mutationId: string;
  collection: string;
  operation: "create" | "update" | "delete" | "arrayPush" | "arrayUpdate" | "arrayRemove";
  entityId?: string;
  argsCiphertext: ArrayBuffer;
  iv: Uint8Array;
  keyId: string;
  baseVersion?: string;
  createdAt: string;
  lastAttemptAt?: string;
  attemptCount: number;
  status: "queued" | "inFlight" | "acked" | "conflicted" | "failed";
}

interface SyncCursor {
  stream: string; // e.g. collection or workspace stream
  cursor: string; // monotonic sequence/offset from server
  updatedAt: string;
}

interface SyncConflict {
  conflictId: string;
  mutationId: string;
  collection: string;
  entityId: string;
  localCiphertext: ArrayBuffer;
  serverCiphertext: ArrayBuffer;
  iv: Uint8Array;
  keyId: string;
  createdAt: string;
  dismissed: boolean;
}

interface KeyringEntry {
  keyId: string;
  wrappedDek: ArrayBuffer;
  wrapAlg: "AES-KW";
  createdAt: string;
}
```

### In-memory runtime model

- normalized entity map by `collection:id`
- derived query subscriptions (similar to RTK query selectors, but local-first)
- optimistic patch history for rollback/rebase on conflict

## APIs

### Package API surface (`@terreno/syncdb`)

#### Bootstrap/configuration

- `createSyncDbClient(config)` - initializes local stores, crypto, transport
- `createSyncDbReduxBridge(client)` - optional bridge for Redux apps migrating from RTK
- `withSyncDbProvider(...)` / hooks for React integration

#### Read/query APIs

- `useEntity({collection, id})`
- `useQuery({collection, filter, sort, page})`
- `selectEntity(state, key)` / `selectQuery(state, key)` for non-hook usage

#### Mutation APIs

- `useMutation({collection, operation})`
- `client.mutate({...})` (local apply + durable outbox enqueue + async flush)
- `resolveConflict({conflictId, strategy: "useServer" | "keepMine"})`

#### Sync/transport APIs

- `client.connectSync()` / `client.disconnectSync()`
- `client.getSyncStatus()` returns online/syncing/authBlocked/conflicted/queue stats
- `client.replayOutbox()` for manual replay triggers

### Server contract requirements (existing/new endpoints/events)

No new broad sync protocol backend is required to start, but these contracts must be supported:

- Mutation ack/nack with stable `mutationId`
- Delta events with monotonic cursor/sequence:
  - `sync:delta`
  - `sync:ack`
  - `sync:nack`
- Snapshot/bootstrap API for initial hydration (`since=cursor` or full snapshot)
- Conflict responses include canonical server document/version metadata

### OpenAPI/codegen direction

- New generator package: `@terreno/syncdb-codegen`
- Input remains backend OpenAPI
- Output should generate typed syncdb query/mutation descriptors instead of RTK hooks

## Notifications

No push/email/SMS scope in this project.

In-app sync state notifications required:

- disconnected/offline state,
- syncing queued changes,
- auth-blocked replay,
- unresolved conflict count.

## UI

`@terreno/syncdb` itself is data-layer first. Minimal reusable UI hooks/components are included:

- `useSyncStatus`
- `useConflicts`
- optional small status helpers for banners

Feature UI composition remains in consuming apps. For migration confidence, `example-frontend` should expose:

- local-first todo list read from syncdb,
- optimistic CRUD while offline,
- conflict resolution controls.

## Feature Flags & Migrations

- Introduce feature flag in consumers: `USE_SYNCDB`.
- Allow side-by-side mode:
  - existing RTK path remains functional,
  - syncdb path enabled per screen/domain.
- Migration order:
  1. todos/read-only,
  2. todos with mutations,
  3. additional resources.
- No data migration on backend required for v1.
- Client-side IndexedDB schema versioning and migration handlers required.

## Activity Log & User Updates

No new backend activity log behavior is required for this phase.

Optional follow-up: include client-origin metadata headers (e.g., `X-Terreno-Syncdb`) on replayed mutations for observability.

## Phases

1. **Foundation and package scaffold**
   - Create `@terreno/syncdb` package structure and public API skeleton.
   - Add typed config and lifecycle primitives.

2. **Local database + encryption**
   - Implement IndexedDB adapter with encrypted entity/outbox storage.
   - Add key management and login/logout key lifecycle.

3. **Local mutation engine**
   - Optimistic local writes, durable outbox enqueue, retry/replay orchestration.
   - Conflict capture and resolution primitives.

4. **Websocket delta sync**
   - Handshake, cursor resume, delta apply pipeline, ack/nack integration.
   - Reconnect handling and idempotent delta application.

5. **React integration + migration bridge**
   - Query/mutation hooks and optional Redux bridge for existing apps.
   - Implement `example-frontend` todos flow using syncdb behind a flag.

6. **Codegen replacement path**
   - Create `@terreno/syncdb-codegen` prototype.
   - Generate typed operation descriptors and migrate one domain.

7. **Validation + docs**
   - Unit/integration testing across crypto, storage, replay, sync ordering, and conflict scenarios.
   - Consumer migration guide and operational playbook.

## Not Included / Future Work

- Bundling and chunking optimizations.
- Service worker asset prefetch strategy.
- Full cross-resource CRDT collaboration model.
- Field-level/semantic conflict merge UI (beyond keep mine/use server).
- Native mobile storage encryption strategy outside web IndexedDB.

## Risks & Mitigations

- **Delta ordering bugs can corrupt local state:** enforce cursor monotonicity + idempotent apply checks and reject out-of-order deltas until gap resolution.
- **Crypto key lifecycle mistakes can cause data loss:** design explicit key versioning/rotation and recovery policy; test logout/login/rekey paths.
- **Migration complexity across apps:** provide Redux bridge and feature-flagged incremental rollout rather than big-bang replacement.
- **Conflict UX scope creep:** lock v1 to two conflict strategies and defer merge editor.
- **Backend contract drift:** define strict event schemas and integration tests between client and server mock transport.

## Acceptance Criteria

### Feature: Local-First Todo Workflow

#### AC-1: Offline create updates UI immediately and queues mutation
**Priority:** P0
**Screen:** Todos Screen
**Preconditions:**
- `USE_SYNCDB` is enabled.
- User is authenticated.
- Network is disabled (browser offline mode).

**Steps:**
1. Navigate to the todos tab and wait for `todos-screen-root`.
2. Enter `Offline task` into `todos-input-title`.
3. Tap `todos-button-save`.
4. Observe `todos-item-offline-task` and `todos-sync-queue-count`.

**Expected results:**
- [ ] `todos-item-offline-task` is visible immediately after tapping save.
- [ ] `todos-sync-status-offline` is visible.
- [ ] `todos-sync-queue-count` increments by 1.

**testIDs needed:** `todos-screen-root`, `todos-input-title`, `todos-button-save`, `todos-item-offline-task`, `todos-sync-status-offline`, `todos-sync-queue-count`

---

#### AC-2: Queued local mutations survive full page reload
**Priority:** P0
**Screen:** Todos Screen
**Preconditions:**
- AC-1 completed with at least one queued mutation.
- Network remains disabled.

**Steps:**
1. Reload the app/browser tab.
2. Return to todos and wait for `todos-screen-root`.
3. Observe `todos-item-offline-task` and `todos-sync-queue-count`.

**Expected results:**
- [ ] `todos-item-offline-task` is still visible after reload.
- [ ] `todos-sync-queue-count` remains greater than 0.
- [ ] No login redirect occurs while session remains valid.

**testIDs needed:** `todos-screen-root`, `todos-item-offline-task`, `todos-sync-queue-count`

---

#### AC-3: Reconnect replays outbox and clears queued state
**Priority:** P0
**Screen:** Todos Screen
**Preconditions:**
- At least one queued local mutation exists.
- User remains authenticated.

**Steps:**
1. Re-enable network connectivity.
2. Wait for `todos-sync-status-syncing`.
3. Wait for `todos-sync-status-online`.
4. Refresh the todos list using `todos-button-refresh`.

**Expected results:**
- [ ] Sync state transitions from offline/queued to syncing, then online.
- [ ] `todos-sync-queue-count` reaches `0`.
- [ ] `todos-item-offline-task` persists in the server-backed list after refresh.

**testIDs needed:** `todos-sync-status-syncing`, `todos-sync-status-online`, `todos-sync-queue-count`, `todos-button-refresh`, `todos-item-offline-task`

---

### Feature: Delta Sync Integrity

#### AC-4: Remote websocket delta applies once and does not duplicate rows
**Priority:** P0
**Screen:** Todos Screen
**Preconditions:**
- Two clients are logged in to the same workspace.
- Both clients have `USE_SYNCDB` enabled and are online.

**Steps:**
1. In client A, create a todo titled `Delta task` with `todos-button-save`.
2. In client B, wait for `todos-item-delta-task` to appear.
3. Trigger a duplicate-delta test event (or reconnect client B to replay last cursor window).
4. Count rows matching `todos-item-delta-task`.

**Expected results:**
- [ ] Client B shows `todos-item-delta-task` without manual refresh.
- [ ] After duplicate/replay delta delivery, row count for `Delta task` remains exactly 1.
- [ ] `todos-sync-cursor-state` reports no cursor gap error.

**testIDs needed:** `todos-button-save`, `todos-item-delta-task`, `todos-sync-cursor-state`

---

### Feature: Conflict Resolution

#### AC-5: Conflict creates resolvable record with keep-mine and use-server actions
**Priority:** P1
**Screen:** Todos Screen
**Preconditions:**
- Two clients edit the same todo record.
- Server conflict contract (`409`) is enabled.

**Steps:**
1. Client A updates `todos-item-shared` title to `Mine`.
2. Client B updates same item title to `Server`.
3. Let client A reconnect/replay to receive conflict.
4. In client A, open `todos-conflict-card-shared` and click `todos-conflict-action-use-server`.
5. Repeat conflict and click `todos-conflict-action-keep-mine`.

**Expected results:**
- [ ] Conflict banner `todos-conflict-banner` appears when `409` is received.
- [ ] Choosing `use-server` updates row text to `Server` and removes conflict card.
- [ ] Choosing `keep-mine` retries mutation and final row text is `Mine` after replay.

**testIDs needed:** `todos-item-shared`, `todos-conflict-banner`, `todos-conflict-card-shared`, `todos-conflict-action-use-server`, `todos-conflict-action-keep-mine`

---

### Feature: Validation and Error Handling

#### AC-6: Invalid local mutation is rejected before queue insertion
**Priority:** P1
**Screen:** Todos Screen
**Preconditions:**
- User is authenticated.
- `USE_SYNCDB` enabled.

**Steps:**
1. Clear `todos-input-title` to empty.
2. Tap `todos-button-save`.
3. Observe `todos-error-title-required` and `todos-sync-queue-count`.

**Expected results:**
- [ ] `todos-error-title-required` is visible.
- [ ] No new todo row is inserted.
- [ ] `todos-sync-queue-count` does not increment.

**testIDs needed:** `todos-input-title`, `todos-button-save`, `todos-error-title-required`, `todos-sync-queue-count`

---

#### AC-7: Auth refresh failure pauses replay without clearing local state
**Priority:** P1
**Screen:** App Root / Todos Screen
**Preconditions:**
- Queue contains at least one pending mutation.
- Access token is expired.
- Refresh endpoint fails (network/server unavailable).

**Steps:**
1. Re-enable network partially so app can attempt replay while refresh endpoint fails.
2. Wait for `app-sync-status-auth-blocked`.
3. Inspect todos list and queued item.
4. Restore refresh endpoint and re-authenticate if needed.

**Expected results:**
- [ ] `app-sync-status-auth-blocked` is shown.
- [ ] Local queued items remain visible; queue is not cleared.
- [ ] After refresh succeeds, replay resumes and queue drains.

**testIDs needed:** `app-sync-status-auth-blocked`, `todos-item-offline-task`, `todos-sync-queue-count`

---

### Feature: Empty State and Navigation

#### AC-8: Empty state renders correctly and transitions after first local create
**Priority:** P1
**Screen:** Todos Screen
**Preconditions:**
- User has zero todos.
- `USE_SYNCDB` enabled.

**Steps:**
1. Open todos tab and wait for `todos-empty-state`.
2. Enter `First local todo` in `todos-input-title`.
3. Tap `todos-button-save`.

**Expected results:**
- [ ] `todos-empty-state` is visible before create.
- [ ] `todos-empty-state` disappears after create.
- [ ] `todos-item-first-local-todo` appears immediately.

**testIDs needed:** `todos-empty-state`, `todos-input-title`, `todos-button-save`, `todos-item-first-local-todo`

---

#### AC-9: Sync status survives tab navigation and returns consistent state
**Priority:** P2
**Screen:** Tabs Navigation (Todos and Profile)
**Preconditions:**
- `USE_SYNCDB` enabled.
- One queued item exists while offline.

**Steps:**
1. From todos, confirm `todos-sync-status-offline`.
2. Navigate using `tabs-button-profile`.
3. Navigate back using `tabs-button-todos`.
4. Observe status and queue count again.

**Expected results:**
- [ ] Returning to todos still shows `todos-sync-status-offline`.
- [ ] `todos-sync-queue-count` matches value before navigation.
- [ ] No duplicate list rows appear after navigation.

**testIDs needed:** `todos-sync-status-offline`, `tabs-button-profile`, `tabs-button-todos`, `todos-sync-queue-count`

---

### Feature: Access Isolation

#### AC-10: Logout clears replay context to prevent cross-user mutation replay
**Priority:** P1
**Screen:** App Root / Login Screen
**Preconditions:**
- User A has queued offline mutations.
- User A logs out; User B logs in on same device/browser profile.

**Steps:**
1. For User A, create queued mutation while offline.
2. Tap `app-button-logout`.
3. Log in as User B with `login-input-email`, `login-input-password`, `login-button-submit`.
4. Re-enable network and open todos.

**Expected results:**
- [ ] User A queued mutations are not replayed under User B session.
- [ ] User B sees only User B data.
- [ ] `todos-sync-queue-count` is 0 after User B login unless User B creates new local mutations.

**testIDs needed:** `app-button-logout`, `login-input-email`, `login-input-password`, `login-button-submit`, `todos-sync-queue-count`

---

### Coverage Notes

- Happy path: AC-1, AC-2, AC-3, AC-4
- Validation: AC-6
- Error handling: AC-7
- Empty states: AC-8
- Permissions/access: AC-10
- Navigation: AC-9
- Data persistence: AC-2, AC-3
- Out of scope confirmation: bundling/chunking optimization remains intentionally excluded from acceptance validation for this plan.

---

## Task List (Bot Consumption)

*Structured task breakdown for automated implementation. Each task should be independently implementable and testable.*

### Phase 1: Foundation

- [ ] **Task 1.1**: Scaffold `@terreno/syncdb` package
  - Description: Create package entrypoints, config types, lifecycle interfaces, and baseline exports.
  - Files: `syncdb/package.json` (new), `syncdb/src/index.ts` (new), `syncdb/src/types.ts` (new), `syncdb/README.md` (new)
  - Depends on: none
  - Acceptance: package compiles and exports typed `createSyncDbClient` placeholder API.

- [ ] **Task 1.2**: Define canonical storage and sync type contracts
  - Description: Add interfaces for local entities, outbox mutations, sync cursor, conflicts, and keyring records.
  - Files: `syncdb/src/storage/types.ts` (new), `syncdb/src/sync/types.ts` (new), `syncdb/src/crypto/types.ts` (new)
  - Depends on: Task 1.1
  - Acceptance: type-only unit tests compile and enforce required fields for all persistence records.

### Phase 2: Local DB + Crypto

- [ ] **Task 2.1**: Implement IndexedDB adapter
  - Description: Build object stores, schema versioning, migrations, and CRUD helpers for entities/outbox/cursors/conflicts.
  - Files: `syncdb/src/storage/indexedDb.ts` (new), `syncdb/src/storage/migrations.ts` (new), `syncdb/src/storage/indexedDb.test.ts` (new)
  - Depends on: Task 1.2
  - Acceptance: tests verify create/read/update/delete and schema upgrade behavior.

- [ ] **Task 2.2**: Implement Web Crypto key management
  - Description: Add DEK generation, wrap/unwrap flow, and keyring persistence.
  - Files: `syncdb/src/crypto/keyManager.ts` (new), `syncdb/src/crypto/keyManager.test.ts` (new)
  - Depends on: Task 1.2
  - Acceptance: tests verify deterministic decryptability with same key material and failure with wrong key.

- [ ] **Task 2.3**: Encrypt/decrypt persistence envelope
  - Description: Add AES-GCM envelope helpers and integrate with IndexedDB adapter reads/writes.
  - Files: `syncdb/src/crypto/envelope.ts` (new), `syncdb/src/storage/secureStorage.ts` (new), tests in `syncdb/src/crypto/envelope.test.ts` (new)
  - Depends on: Task 2.1, Task 2.2
  - Acceptance: plaintext is never written to IndexedDB stores in tests; decrypt roundtrip passes.

### Phase 3: Local Mutation Engine

- [ ] **Task 3.1**: Build optimistic apply/revert pipeline
  - Description: Add mutation planner that applies local patch and stores inverse patch for rollback.
  - Files: `syncdb/src/mutations/optimistic.ts` (new), `syncdb/src/mutations/optimistic.test.ts` (new)
  - Depends on: Task 2.3
  - Acceptance: optimistic updates are immediate and reversable in unit tests.

- [ ] **Task 3.2**: Durable outbox enqueue and replay state machine
  - Description: Implement queue transitions (`queued` -> `inFlight` -> `acked/conflicted/failed`) and retry metadata.
  - Files: `syncdb/src/mutations/outbox.ts` (new), `syncdb/src/mutations/outbox.test.ts` (new)
  - Depends on: Task 3.1
  - Acceptance: replay state transitions and retry counters are deterministic in tests.

- [ ] **Task 3.3**: Conflict store and resolver actions
  - Description: Persist conflict objects and implement `useServer`/`keepMine` resolution behavior.
  - Files: `syncdb/src/mutations/conflicts.ts` (new), `syncdb/src/mutations/conflicts.test.ts` (new)
  - Depends on: Task 3.2
  - Acceptance: both resolution strategies update outbox/entity state as expected.

### Phase 4: Websocket Delta Sync

- [ ] **Task 4.1**: Implement sync transport client
  - Description: Add websocket handshake, authentication payload, and reconnect strategy.
  - Files: `syncdb/src/sync/transport.ts` (new), `syncdb/src/sync/transport.test.ts` (new)
  - Depends on: Task 1.2
  - Acceptance: transport emits lifecycle events and reconnect behavior in tests.

- [ ] **Task 4.2**: Implement cursor-aware delta apply engine
  - Description: Apply server deltas to local entities with idempotency and monotonic cursor checks.
  - Files: `syncdb/src/sync/deltaApplier.ts` (new), `syncdb/src/sync/deltaApplier.test.ts` (new)
  - Depends on: Task 2.3, Task 4.1
  - Acceptance: duplicate/out-of-order deltas are safely handled; valid ordered deltas update local store.

- [ ] **Task 4.3**: Wire ack/nack to outbox replay loop
  - Description: Connect transport acknowledgements to outbox mutation completion/conflict paths.
  - Files: `syncdb/src/sync/replayCoordinator.ts` (new), `syncdb/src/sync/replayCoordinator.test.ts` (new)
  - Depends on: Task 3.3, Task 4.2
  - Acceptance: ack removes queued mutation; nack creates conflict and preserves retry semantics.

### Phase 5: React + Migration

- [ ] **Task 5.1**: Implement React hooks API
  - Description: Add `useEntity`, `useQuery`, `useMutation`, `useSyncStatus`, and conflict hooks.
  - Files: `syncdb/src/react/hooks.ts` (new), `syncdb/src/react/provider.tsx` (new), `syncdb/src/react/hooks.test.tsx` (new)
  - Depends on: Task 3.3, Task 4.3
  - Acceptance: hooks re-render on local mutation and remote delta updates.

- [ ] **Task 5.2**: Add Redux migration bridge
  - Description: Provide optional bridge/adapters for existing Redux-based apps migrating from `@terreno/rtk`.
  - Files: `syncdb/src/bridge/reduxBridge.ts` (new), `syncdb/src/bridge/reduxBridge.test.ts` (new)
  - Depends on: Task 5.1
  - Acceptance: bridge exposes selectors and dispatch-compatible mutation wrappers.

- [ ] **Task 5.3**: Migrate example todos behind feature flag
  - Description: Integrate syncdb into `example-frontend` for one domain (todos) with `USE_SYNCDB` toggle.
  - Files: `example-frontend/store/index.ts`, `example-frontend/store/sdk.ts`, `example-frontend/app/(tabs)/index.tsx`, `example-frontend/app/_layout.tsx`
  - Depends on: Task 5.1, Task 5.2
  - Acceptance: toggling flag changes data path to syncdb and preserves todo CRUD behavior.

### Phase 6: Codegen + Documentation

- [ ] **Task 6.1**: Prototype syncdb codegen package
  - Description: Build `@terreno/syncdb-codegen` to emit typed operation descriptors from OpenAPI.
  - Files: `syncdb-codegen/package.json` (new), `syncdb-codegen/src/index.ts` (new), tests under `syncdb-codegen/src/*.test.ts` (new)
  - Depends on: Task 1.1
  - Acceptance: generator emits descriptor file for at least one example endpoint group.

- [ ] **Task 6.2**: Add consumer migration documentation
  - Description: Document install/configuration/migration steps from `@terreno/rtk` to `@terreno/syncdb`.
  - Files: `syncdb/README.md`, `docs/implementationPlans/syncdb-local-first.md`
  - Depends on: Task 5.3
  - Acceptance: docs include side-by-side migration example and rollout checklist.

- [ ] **Task 6.3**: Validation suite run and stabilization
  - Description: Run compile/lint/tests for new packages and touched example app flows, fixing regressions.
  - Files: no dedicated source file; any fixes in touched files
  - Depends on: Task 6.2
  - Acceptance: relevant package compile/test/lint commands pass with documented outputs.
