# Task List: SyncDB Local-First Data Layer

*Structured task breakdown for automated implementation. Each task should be independently implementable and testable.*

## Phase 1: Foundation

- [ ] **Task 1.1**: Scaffold `@terreno/syncdb` package
  - Description: Create the package with core entrypoints, lifecycle interfaces, and typed configuration.
  - Files: `syncdb/package.json` (new), `syncdb/src/index.ts` (new), `syncdb/src/types.ts` (new), `syncdb/README.md` (new)
  - Depends on: none
  - Acceptance: package compiles and exports `createSyncDbClient` and configuration types.

- [ ] **Task 1.2**: Define storage and sync contracts
  - Description: Add canonical interfaces for entities, outbox records, sync cursors, conflicts, and keyring entries.
  - Files: `syncdb/src/storage/types.ts` (new), `syncdb/src/sync/types.ts` (new), `syncdb/src/crypto/types.ts` (new)
  - Depends on: Task 1.1
  - Acceptance: type checks enforce required fields and operations.

## Phase 2: Local DB and Encryption

- [ ] **Task 2.1**: Implement IndexedDB adapter with migrations
  - Description: Add object stores for entities/outbox/cursors/conflicts/keyring and schema version migration support.
  - Files: `syncdb/src/storage/indexedDb.ts` (new), `syncdb/src/storage/migrations.ts` (new), `syncdb/src/storage/indexedDb.test.ts` (new)
  - Depends on: Task 1.2
  - Acceptance: storage CRUD + migration tests pass.

- [ ] **Task 2.2**: Implement key manager (Web Crypto)
  - Description: Add DEK generation + wrap/unwrap logic and persistence integration.
  - Files: `syncdb/src/crypto/keyManager.ts` (new), `syncdb/src/crypto/keyManager.test.ts` (new)
  - Depends on: Task 1.2
  - Acceptance: key lifecycle tests pass for generate/wrap/unwrap/reload.

- [ ] **Task 2.3**: Encrypt IndexedDB payloads at rest
  - Description: Add AES-GCM envelope encryption/decryption and integrate in storage read/write paths.
  - Files: `syncdb/src/crypto/envelope.ts` (new), `syncdb/src/storage/secureStorage.ts` (new), `syncdb/src/crypto/envelope.test.ts` (new)
  - Depends on: Task 2.1, Task 2.2
  - Acceptance: tests verify no plaintext persistence and successful decrypt roundtrip.

## Phase 3: Local Mutation Engine

- [ ] **Task 3.1**: Add optimistic local mutation application
  - Description: Apply local patches immediately and retain inverse patches for rollback.
  - Files: `syncdb/src/mutations/optimistic.ts` (new), `syncdb/src/mutations/optimistic.test.ts` (new)
  - Depends on: Task 2.3
  - Acceptance: immediate local apply and rollback tests pass.

- [ ] **Task 3.2**: Implement durable outbox state machine
  - Description: Persist queued mutations and manage transitions `queued -> inFlight -> acked/conflicted/failed`.
  - Files: `syncdb/src/mutations/outbox.ts` (new), `syncdb/src/mutations/outbox.test.ts` (new)
  - Depends on: Task 3.1
  - Acceptance: replay transition and retry logic tests pass.

- [ ] **Task 3.3**: Implement conflict capture and resolution
  - Description: Persist conflict records and support `useServer` and `keepMine` resolution paths.
  - Files: `syncdb/src/mutations/conflicts.ts` (new), `syncdb/src/mutations/conflicts.test.ts` (new)
  - Depends on: Task 3.2
  - Acceptance: both resolution strategies correctly update local state and queue state.

## Phase 4: Websocket Delta Sync

- [ ] **Task 4.1**: Build sync transport client
  - Description: Add websocket connect/auth/reconnect lifecycle and sync event channel handling.
  - Files: `syncdb/src/sync/transport.ts` (new), `syncdb/src/sync/transport.test.ts` (new)
  - Depends on: Task 1.2
  - Acceptance: transport lifecycle tests pass including reconnect behavior.

- [ ] **Task 4.2**: Implement cursor-aware delta applier
  - Description: Apply deltas idempotently with monotonic cursor checks and gap handling.
  - Files: `syncdb/src/sync/deltaApplier.ts` (new), `syncdb/src/sync/deltaApplier.test.ts` (new)
  - Depends on: Task 2.3, Task 4.1
  - Acceptance: ordered delta tests pass; duplicate/out-of-order deltas are safely handled.

- [ ] **Task 4.3**: Wire ack/nack replay coordinator
  - Description: Connect outbox replay to server ack/nack responses and conflict creation.
  - Files: `syncdb/src/sync/replayCoordinator.ts` (new), `syncdb/src/sync/replayCoordinator.test.ts` (new)
  - Depends on: Task 3.3, Task 4.2
  - Acceptance: ack finalizes queued mutations; nack creates conflict records.

## Phase 5: App Integration and Migration Bridge

- [ ] **Task 5.1**: Implement React hooks and provider
  - Description: Add `useEntity`, `useQuery`, `useMutation`, `useSyncStatus`, and context provider wiring.
  - Files: `syncdb/src/react/provider.tsx` (new), `syncdb/src/react/hooks.ts` (new), `syncdb/src/react/hooks.test.tsx` (new)
  - Depends on: Task 3.3, Task 4.3
  - Acceptance: hooks update on local mutations and remote deltas.

- [ ] **Task 5.2**: Add Redux migration bridge
  - Description: Provide optional adapter for Redux-based consumers transitioning from `@terreno/rtk`.
  - Files: `syncdb/src/bridge/reduxBridge.ts` (new), `syncdb/src/bridge/reduxBridge.test.ts` (new)
  - Depends on: Task 5.1
  - Acceptance: bridge supports selector and dispatch-driven mutation usage.

- [ ] **Task 5.3**: Integrate `example-frontend` todos behind `USE_SYNCDB`
  - Description: Switch todos flow to syncdb under a feature flag while keeping legacy path available.
  - Files: `example-frontend/store/index.ts`, `example-frontend/store/sdk.ts`, `example-frontend/app/(tabs)/index.tsx`, `example-frontend/app/_layout.tsx`
  - Depends on: Task 5.1, Task 5.2
  - Acceptance: flagged path supports offline local create/update/delete and sync reconciliation.

## Phase 6: Codegen and Validation

- [ ] **Task 6.1**: Prototype `@terreno/syncdb-codegen`
  - Description: Create codegen package that emits typed syncdb operation descriptors from OpenAPI.
  - Files: `syncdb-codegen/package.json` (new), `syncdb-codegen/src/index.ts` (new), `syncdb-codegen/src/*.test.ts` (new)
  - Depends on: Task 1.1
  - Acceptance: generator produces valid descriptors for one sample domain.

- [ ] **Task 6.2**: Author migration docs
  - Description: Document migration path from `@terreno/rtk` to `@terreno/syncdb` and rollout strategy.
  - Files: `syncdb/README.md`, `docs/implementationPlans/syncdb-local-first.md`
  - Depends on: Task 5.3
  - Acceptance: docs include setup, API usage, and feature-flag rollout playbook.

- [ ] **Task 6.3**: Run validation suite
  - Description: Execute compile, lint, and tests for touched packages and resolve regressions.
  - Files: as needed in touched packages
  - Depends on: Task 6.2
  - Acceptance: relevant compile/lint/test commands pass with no blockers.
