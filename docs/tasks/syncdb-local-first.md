# Task List: SyncDB Local-First Data Layer (v2)

*Structured task breakdown for automated implementation. Each task should be independently implementable and testable. Companion to `docs/implementationPlans/syncdb-local-first.md`.*

## Phase 1: Server sync foundation

- [x] **Task 1.1**: Sync types + registry + modelRouter `sync` option
  - Description: Define `SyncConfig` (scope strategies: owner, tenant with configurable field, broadcast, custom resolver; optional `responseHandler`) and shared protocol types (`SyncDelta`, `SyncMutateRequest`, `SyncAck`, `SyncNack`). Add `sync?: SyncConfig` to `modelRouterOptions`; registration enrolls the model in a sync registry (modeled on `api/src/realtime/registry.ts`) and validates at startup that the model uses `isDeletedPlugin` (soft delete) — throw with a clear message otherwise.
  - Files: `api/src/sync/types.ts` (new), `api/src/sync/registry.ts` (new), `api/src/api.ts`, `api/src/index.ts`
  - Depends on: none
  - Acceptance: `bun run api:test` — registering sync on a soft-delete model succeeds; on a hard-delete model throws at startup; registry exposes scope config for stream resolution.

- [x] **Task 1.2**: `_syncSeq` plugin + SyncCounter model + stream resolution
  - Description: Developer-applied Mongoose schema plugin (`syncPlugin` — middleware cannot be attached post-compile, so registration validates presence instead of applying it) whose hooks consult the sync registry at write time: resolve the doc's stream from scope config, claim the next seq via `SyncCounter` `$inc`, stamp `_syncSeq`. Validation failures never burn a seq (Mongoose validates before user pre-save hooks); the claim joins the caller's session when present (no owned per-write transaction — hot-counter WriteConflicts; residual write-failure burns are benign gaps by design). Hooks **all single-doc write paths**: `save`, `insertMany`, `updateOne`, `findOneAndUpdate`, `replaceOne`, `findOneAndReplace`; `updateMany`, `deleteMany`, `deleteOne`, and `findOneAndDelete` **throw on synced models**; `bulkWrite` bypasses middleware (documented restriction). On scope-field change, stamp `_syncPrevStream` (previous stream key) so the watcher can tombstone the old stream without Mongo pre-images. Compound index on scope field + `_syncSeq` created at registration. Stream key format: `{collection}|{scopeType}:{scopeValue}` (broadcast: `{collection}|all`). All schema fields carry `description`.
  - Files: `api/src/sync/syncSeqPlugin.ts` (new), `api/src/sync/models.ts` (new), `api/src/sync/streams.ts` (new)
  - Depends on: 1.1
  - Acceptance: unit tests prove monotonic seqs per stream across concurrent writes; a write that fails validation does not consume a seq (no phantom gap); **each** hooked write path stamps `_syncSeq`; guarded operations on a synced model throw (and pass through on unregistered models); scope-field change stamps `_syncPrevStream` on both save and findOneAndUpdate paths; tombstone updates are stamped; owner/tenant/broadcast/custom scopes resolve correct stream keys.

- [x] **Task 1.3**: `GET /sync/snapshot` endpoint
  - Description: `createOpenApiBuilder` route returning `{entities: [{id, data, seq, deleted}], cursor, hasMore}` for a collection, filtered server-side by the caller's scope (owner/tenant via registry config), honoring model `list` permissions, paginated by `_syncSeq` ascending (default limit 500). **Must explicitly bypass `isDeletedPlugin`'s auto-filter** (`api/src/plugins.ts:52-57` injects `{deleted: {$ne: true}}` unless the query mentions `deleted`) with `deleted: {$in: [true, false]}` so tombstones are returned. `data` passes through the sync `responseHandler` fallback chain (sync responseHandler > model responseHandler > toJSON). Mounted by a `SyncApp` TerrenoPlugin.
  - Files: `api/src/sync/routes.ts` (new), `api/src/sync/syncApp.ts` (new), `api/src/terrenoApp.ts`
  - Depends on: 1.2
  - Acceptance: API tests — full snapshot at cursor=0; incremental at cursor=N includes updates **and a soft-deleted doc appears as a tombstone (regression test against the auto-filter)**; scope isolation (user A never sees user B's docs); pagination hasMore/cursor advance; 401 unauthenticated.

- [x] **Task 1.4**: SyncKey model + `GET /sync/key`
  - Description: Per-user key material (32 random bytes base64, generated server-side on first request, unique index on userId). Route returns own key material only. Creation must be **race-safe**: upsert with `$setOnInsert` (or catch the dup-key error and re-read) so two concurrent first calls both return the single persisted material — a loser deriving a key from unpersisted bytes would produce an undecryptable store.
  - Files: `api/src/sync/models.ts`, `api/src/sync/routes.ts`
  - Depends on: 1.1
  - Acceptance: API tests — first call creates, second call returns same material, **two concurrent first calls return identical material**, distinct users get distinct material, unauthenticated 401.

## Phase 2: Server mutation channel + deltas

- [ ] **Task 2.0**: Extract transport-agnostic CRUD executors from modelRouter
  - Description: **The load-bearing refactor of this IP.** modelRouter's create/update/delete logic is currently inline inside Express `asyncHandler` closures with permissions/validation as middleware (`api/src/api.ts:648-745` and onward) — no callable write path exists. Extract `executeCreate/executeUpdate/executeDelete({model, options, user, body, id, concurrencyCheck})` that run permissions, pre/post hooks, and validation without `req`/`res`; migrate the REST handlers to thin wrappers over them. `executeUpdate`'s concurrency check accepts either the legacy `If-Unmodified-Since` timestamp (REST) or a `baseSeq` integer (sync) so both LWW modes share one code path.
  - Files: `api/src/executors.ts` (new) or `api/src/api.ts` (extract in place), `api/src/index.ts`
  - Depends on: none (can start immediately; blocks 2.1)
  - Acceptance: **the entire existing @terreno/api test suite passes unchanged**; new unit tests drive each executor directly (no HTTP) covering permission denial, hook invocation order, and validation failure.

- [ ] **Task 2.1**: Shared mutation handler + SyncMutation idempotency ledger
  - Description: `applySyncMutation({user, mutation})` that (a) **atomically claims** the mutation by inserting a `SyncMutation` row with status `pending` (unique index on mutationId) *before* applying — a dup-key error means another delivery owns/completed it, so wait/read back the recorded outcome instead of re-applying (closes the concurrent socket-retry + HTTP-fallback race); (b) executes create/update/delete through the Task 2.0 executors (permissions, pre/post hooks, validation); (c) passes `baseVersion` as the executor's `baseSeq` concurrency check — mismatch yields a conflict outcome carrying the canonical serialized doc + seq; (d) finalizes the ledger row with the outcome (TTL 30d).
  - Files: `api/src/sync/mutationHandler.ts` (new), `api/src/sync/models.ts`
  - Depends on: 1.2, 2.0
  - Acceptance: unit tests — successful apply; duplicate mutationId returns recorded outcome without re-applying; **two concurrent deliveries of the same mutationId apply exactly once**; conflict on stale baseVersion includes server doc; permission denial → unauthorized outcome; validation failure → validation outcome.

- [ ] **Task 2.2**: `POST /sync/mutate` HTTP endpoint
  - Description: Thin route over `applySyncMutation`: 200 with ack body; 409 with nack body for conflicts; 403/422 mapped to `unauthorized`/`validation` nack codes.
  - Files: `api/src/sync/routes.ts`
  - Depends on: 2.1
  - Acceptance: API tests mirror all 2.1 outcomes over HTTP with correct status codes.

- [ ] **Task 2.3**: Socket `sync:mutate`/`sync:ack`/`sync:nack` + `sync:subscribe` with tenant rooms
  - Description: Socket handlers calling `applySyncMutation` and replying ack/nack. `sync:subscribe {collections}` resolves the user's streams: owner scope reuses `user:{id}` room membership; tenant scope joins `sync:{stream}` rooms via a new `getUserStreams(user)` config callback on the sync plugin; broadcast uses the model room. Per-socket subscription caps consistent with existing handlers.
  - Files: `api/src/sync/socketHandlers.ts` (new), `api/src/realtime/realtimeApp.ts` (install hook), `api/src/sync/syncApp.ts`
  - Depends on: 2.1
  - Acceptance: integration tests with a socket.io client — mutate→ack roundtrip; conflict→nack with server doc; subscribe joins correct rooms per scope type; cap enforcement.

- [ ] **Task 2.4**: `sync:delta` emission from the change-stream watcher
  - Description: Extend `changeStreamWatcher` so sync-registered models also emit `sync:delta {collection, id, method, data?, seq, stream, deleted?}` to the stream's rooms with per-socket permission checks (reuse `emitToAuthorizedRoom`). `seq`/`stream` are read from the post-image (`fullDocument._syncSeq`; the watcher runs `updateLookup`, `changeStreamWatcher.ts:419`). Scope changes use the **`_syncPrevStream` field stamped by the 1.2 plugin** (change streams run `fullDocumentBeforeChange: "off"`, so the old scope is not otherwise available): when post-image `_syncPrevStream` differs from the current stream, emit a tombstone delta to the previous stream + a create delta to the new stream. `realtime` and `sync` may coexist on a model: distinct event names, double emission accepted, documented as transitional.
  - Files: `api/src/realtime/changeStreamWatcher.ts`, `api/src/sync/streams.ts`
  - Depends on: 2.3 (and 1.2's `_syncPrevStream`)
  - Acceptance: integration tests — create/update/soft-delete each produce exactly one delta with correct seq on the right stream; tenant A's socket never receives tenant B's delta; scope-move emits tombstone+create pair **without Mongo pre-images enabled**; a model with both `realtime` and `sync` emits both event types with no cross-talk.

- [ ] **Task 2.5**: Pluggable socket authenticator (Better Auth support)
  - Description: Refactor `RealtimeApp`'s hardcoded `@thream/socketio-jwt` middleware into an authenticator chain: legacy JWT validator (default, behavior unchanged) plus a Better Auth session-token validator (validates via Better Auth session lookup and populates the same `socket.decodedToken` shape consumed by `getSocketUser`).
  - Files: `api/src/realtime/socketAuth.ts` (new), `api/src/realtime/realtimeApp.ts`, `api/src/realtime/socketUser.ts`
  - Depends on: none (parallel with 2.1–2.4)
  - Acceptance: tests — legacy JWT connects exactly as before; Better Auth session token connects and resolves the same user identity; invalid tokens rejected.

## Phase 3: Client core (@terreno/syncdb)

- [ ] **Task 3.1**: Package scaffold
  - Description: New workspace package `syncdb/` (`@terreno/syncdb`): tsconfig, biome, bun test setup; deps `tinybase` + `luxon` (catalog where available); optional peers `expo-sqlite`, `react`, `socket.io-client`. Root scripts (`syncdb:compile` etc.) and inclusion in `compile`/`lint`/`test`/bootstrap pipelines.
  - Files: `syncdb/package.json` (new), `syncdb/tsconfig.json` (new), `syncdb/biome.jsonc` (new), `syncdb/src/index.ts` (new), root `package.json`
  - Depends on: none
  - Acceptance: `bun run bootstrap:update` compiles the package; empty test suite runs green; lint passes.

- [ ] **Task 3.2**: MergeableStore schema + typed entity accessors
  - Description: `createSyncStore({collections})` building a `MergeableStore` with the documented table layout (`{collection}`, `_outbox`, `_cursors`, `_conflicts`; values `schemaVersion`, `lastUserId`); typed accessors: upsert/get/list/softDelete/clear per collection with JSON `data` cell round-tripping. Harvest/adapt `storage/store.ts` + `storage/schema.ts` from PR #835.
  - Files: `syncdb/src/storage/store.ts` (new), `syncdb/src/storage/schema.ts` (new), `syncdb/src/storage/types.ts` (new)
  - Depends on: 3.1
  - Acceptance: unit tests — accessor round-trips, tombstone filtering in list, per-collection isolation.

- [ ] **Task 3.3**: Outbox state machine
  - Description: Durable outbox on the `_outbox` table with lifecycle `queued→inFlight→acked|conflicted|failed`, FIFO per collection, attemptCount, and per-user isolation (mutations record userId; replay skips mismatches — semantics ported from `rtk/src/offlineMiddleware.ts:96-107`). Harvest/adapt `mutations/outbox.ts` from #835.
  - Files: `syncdb/src/mutations/outbox.ts` (new)
  - Depends on: 3.2
  - Acceptance: unit tests — every legal/illegal state transition, FIFO ordering, user-isolation skip.

- [ ] **Task 3.4**: Cursor store + idempotent delta applier
  - Description: `_cursors` accessors + `applyDelta(delta)`: ignore if `delta.seq <= entity.seq` (idempotent); apply create/update/tombstone; advance the cursor **keyed by `delta.stream`** (a socket interleaves deltas from multiple independent streams/counters); report seq jumps (`delta.seq > cursor(delta.stream) + 1`) as a *reconcile hint* — jumps are legitimate when permission-filtered deltas skip seqs, so the hint is rate-limited downstream, never treated as proof of loss. Never overwrite an entity that has a pending outbox mutation (optimistic state protected; conflict resolution decides). Harvest/adapt `sync/cursor.ts` + `sync/deltaApplier.ts` from #835.
  - Files: `syncdb/src/sync/cursor.ts` (new), `syncdb/src/sync/deltaApplier.ts` (new)
  - Depends on: 3.3
  - Acceptance: unit tests — idempotency on duplicate/out-of-order deltas, pending-entity protection, seq-jump reporting, tombstone application.

- [ ] **Task 3.5**: Persister factories (expo-sqlite, memory, platform resolution)
  - Description: `persisterFactory` abstraction; native default via TinyBase `ExpoSqlitePersister` (JSON mode); in-memory persister for tests/SSR; platform resolution via `.native.ts`/`.web.ts` files (web default lands in Task 4.2).
  - Files: `syncdb/src/persisters/types.ts` (new), `syncdb/src/persisters/memoryPersister.ts` (new), `syncdb/src/persisters/defaultPersisterFactory.ts` (+ `.native.ts`, `.web.ts`) (new)
  - Depends on: 3.2
  - Acceptance: unit tests — memory persister save/load round-trips a MergeableStore including outbox rows.

## Phase 4: Client crypto

- [ ] **Task 4.1**: AES-GCM payload codec
  - Description: `PayloadCodec` interface + AES-256-GCM implementation over Web Crypto (`crypto.subtle`), fresh IV per encrypt, versioned envelope `{v, iv, ciphertext}`. Harvest/adapt `crypto/aesGcmCodec.ts` from #835.
  - Files: `syncdb/src/crypto/types.ts` (new), `syncdb/src/crypto/aesGcmCodec.ts` (new)
  - Depends on: 3.1
  - Acceptance: unit tests — round-trip, tamper detection (auth tag failure), distinct IVs per encrypt.

- [ ] **Task 4.2**: EncryptedIndexedDbPersister (web default, encryption on)
  - Description: `createCustomPersister` that serializes mergeable content, encrypts via the codec, and stores a single blob in IndexedDB; decrypt-on-load with corrupt/undecryptable data treated as an empty store + `onDecryptFailure` callback (triggers wipe + re-bootstrap). Debounced saves (500ms trailing). Becomes the web default persister factory.
  - Files: `syncdb/src/persisters/encryptedIndexedDbPersister.ts` (new), `syncdb/src/persisters/defaultPersisterFactory.web.ts`
  - Depends on: 4.1, 3.5
  - Acceptance: unit tests (fake-indexeddb) — round-trip; encrypted-at-rest assertion (raw IDB blob contains no plaintext entity markers); decrypt-failure path invokes callback and yields empty store.

- [ ] **Task 4.3**: Key providers
  - Description: `KeyProvider` interface; `serverKeyProvider` (default): fetch `GET /sync/key`, HKDF-derive an AES-256-GCM key (salt = `{name}:{userId}`), import as a non-extractable CryptoKey, cache in IndexedDB for offline cold start, wipe+re-bootstrap on rotation-induced decrypt failure; `localKeyProvider`: generate + store a non-extractable CryptoKey locally.
  - Files: `syncdb/src/crypto/keyProviders.ts` (new)
  - Depends on: 4.1
  - Acceptance: unit tests — deterministic derivation from the same material; cached key reused without network; local provider persists across fresh module init against the same fake IDB.

- [ ] **Task 4.4**: Wipe-on-user-change
  - Description: Client watches `authProvider.onAuthChange`; when userId differs from stored `lastUserId`, destroy persisted data, reset the store, clear cached keys, and re-bootstrap.
  - Files: `syncdb/src/client.ts`
  - Depends on: 4.3 (implemented alongside 5.4 client assembly)
  - Acceptance: unit test — user switch wipes entities/outbox/cursors/conflicts and updates `lastUserId`.

## Phase 5: Client sync engine + transport

- [ ] **Task 5.1**: SyncTransport interface + Socket.io transport
  - Description: `SyncTransport` contract (connect/disconnect, subscribe, sendMutation→ack/nack promise with timeout, onDelta, onStatusChange). Socket.io implementation speaking the Phase 2 protocol with reconnection and auth-token refresh patterns modeled on `rtk/src/socket.ts`. `authProvider.getToken()` is called per connection attempt and per HTTP request (never cached by the transport) so Better Auth session refresh is picked up transparently; a 401 mid-replay or mid-bootstrap pauses and retries once after the next `onAuthChange`. Keep a `fakeTransport` for tests (harvest `sync/types.ts` + `sync/fakeTransport.ts` from #835).
  - Files: `syncdb/src/sync/types.ts` (new), `syncdb/src/sync/socketTransport.ts` (new), `syncdb/src/sync/fakeTransport.ts` (new)
  - Depends on: 3.4
  - Acceptance: unit tests against fakeTransport (send/ack/nack/timeout, delta delivery); socket transport exercised end-to-end in 5.5.

- [ ] **Task 5.2**: HTTP bootstrap + fallback mutation channel
  - Description: `bootstrap({collections})` paging `GET /sync/snapshot` per stream through the delta applier; HTTP `POST /sync/mutate` fallback used when the socket is unavailable; reconcile = snapshot-from-cursor.
  - Files: `syncdb/src/sync/bootstrap.ts` (new), `syncdb/src/sync/httpChannel.ts` (new)
  - Depends on: 5.1
  - Acceptance: unit tests — multi-page bootstrap advances each stream cursor exactly once; HTTP fallback engaged when socket down.

- [ ] **Task 5.3**: Replay coordinator
  - Description: FIFO-per-collection outbox flush: mark inFlight → send → ack finalizes (clear `pendingMutationId`, apply server seq); conflict-nack records a `_conflicts` entry and pauses that entity; unauthorized-nack pauses replay until auth change; error-nack retries with backoff then failed. Triggered on start, reconnect, auth restore, and new enqueue. Harvest/adapt `sync/replayCoordinator.ts` from #835.
  - Files: `syncdb/src/sync/replayCoordinator.ts` (new)
  - Depends on: 5.1
  - Acceptance: unit tests — each ack/nack path, FIFO ordering under interleaved enqueues, backoff, auth-pause/resume.

- [ ] **Task 5.4**: Conflict resolver + reconcile heuristics + client assembly
  - Description: `resolveConflict({mutationId, strategy})` — `useServer`: apply server doc, drop mutation; `keepMine`: re-enqueue with fresh baseVersion. Reconcile triggers: reconnect, seq-jump hints (**rate-limited to once per 30s per stream** — jumps can be legitimate permission-filtered gaps), and a **periodic reconcile** (visibility change / every few minutes while connected) so deltas missed with no observable jump still converge. Assemble `createSyncDb`: start/stop, mutate (local apply + enqueue + flush), getSyncStatus, wipe-on-user-change (4.4). On web, guard persister saves with the Web Locks API (single-writer across tabs; non-holders stay in-memory) to prevent multi-tab blob clobbering losing outbox rows.
  - Files: `syncdb/src/mutations/resolveConflict.ts` (new), `syncdb/src/client.ts` (new), `syncdb/src/index.ts`
  - Depends on: 5.2, 5.3, 4.3
  - Acceptance: unit tests — both strategies, status aggregation, seq-jump triggers rate-limited reconcile, periodic reconcile fires, second concurrent client instance does not clobber the persisted outbox.

- [ ] **Task 5.5**: End-to-end integration test against a real backend
  - Description: bun integration test spinning up a TerrenoApp (via `@terreno/test` in-memory Mongo replica set) with a synced model; syncdb client (memory persister + socket transport) performs: bootstrap; live delta receipt; offline mutate → replay → ack; stale-base conflict → nack → resolve both ways; duplicate mutationId idempotency.
  - Files: `api/src/sync/integration.test.ts` (new — lives in the api package by decision: the test needs TerrenoApp + `@terreno/test` Mongo, and syncdb must stay free of backend devDependencies; syncdb is consumed as a workspace dep of the test)
  - Depends on: 5.4, Phase 2 complete
  - Acceptance: all listed scenario assertions pass in CI.

## Phase 6: React layer + Better Auth adapter

- [ ] **Task 6.1**: SyncDbProvider + hooks
  - Description: `SyncDbProvider client={...}`; hooks over TinyBase reactive listeners: `useEntity`, `useQuery` (filter/sort in JS with memoization), `useMutate`, `useSyncStatus`, `useConflicts`. React Native Web compatible. Harvest/adapt `react/hooks.ts` + `react/provider.tsx` from #835.
  - Files: `syncdb/src/react/provider.tsx` (new), `syncdb/src/react/hooks.ts` (new)
  - Depends on: 5.4
  - Acceptance: hook tests (@testing-library/react-native) — re-render on local write and on applied delta; status and conflict reactivity.

- [ ] **Task 6.2**: Better Auth AuthProvider adapter
  - Description: `betterAuthAdapter(authClient)` implementing `{getToken, getUserId, onAuthChange}` against the Better Auth client used in-repo (`rtk/src/betterAuthClient.ts` / admin-spa pattern).
  - Files: `syncdb/src/auth/betterAuthAdapter.ts` (new), `syncdb/src/auth/types.ts` (new)
  - Depends on: 3.1
  - Acceptance: unit tests with a stubbed Better Auth client — token/userId passthrough, auth-change fan-out.

## Phase 7: Example integration + docs

- [ ] **Task 7.1**: example-backend sync enablement
  - Description: Add `sync: {scope: {type: "owner"}}` to the todos router; **refactor `bulkComplete` off `Todo.updateMany`** (`example-backend/src/api/todos.ts:22`) to a per-doc loop — `updateMany` throws on synced models per Task 1.2; add a tenant-scoped example model (`projects` with `organizationId`) demonstrating `{type: "tenant"}` + `getUserStreams`; seed data for both.
  - Files: `example-backend/src/api/todos.ts`, `example-backend/src/models/project.ts` (new), `example-backend/src/api/projects.ts` (new), `example-backend/src/server.ts`, seed script
  - Depends on: Phase 2
  - Acceptance: backend boots; `bulkComplete` still works and every affected todo gets a fresh `_syncSeq`; snapshot/mutate/delta verified against todos + projects; OpenAPI snapshot updated.

- [ ] **Task 7.2**: example-frontend syncdb integration behind USE_SYNCDB
  - Description: Create the syncdb client (Better Auth adapter, default persisters/key provider); re-implement the Todos screen data layer on `useQuery`/`useMutate` behind the `USE_SYNCDB` OpenFeature flag (verify the example-frontend flag plumbing via `useTerrenoFeatureFlags` exists for this flag; add it if missing); flag off = RTK path unchanged.
  - Files: `example-frontend/store/syncdb.ts` (new), `example-frontend/app/(tabs)/index.tsx`, `example-frontend/app/_layout.tsx`
  - Depends on: Phase 6, 7.1
  - Acceptance: flag on — todos CRUD works offline-first (offline create appears instantly, syncs on reconnect); flag off — RTK behavior unchanged.

- [ ] **Task 7.3**: SyncStatusBanner + ConflictSheet + dev panel
  - Description: Banner (`sync-status-banner`, `sync-queued-count`, `sync-conflict-badge`); conflict sheet (`conflict-sheet`, `conflict-item-{id}`, `conflict-keep-mine-button`, `conflict-use-server-button`); dev-only panel (`syncdb-dev-panel`, `syncdb-offline-toggle`, `syncdb-wipe-button`). All from @terreno/ui primitives.
  - Files: `example-frontend/components/SyncStatusBanner.tsx` (new), `example-frontend/components/ConflictSheet.tsx` (new), `example-frontend/components/SyncDevPanel.tsx` (new)
  - Depends on: 7.2
  - Acceptance: manual verification per acceptance criteria; all testIDs present.

- [ ] **Task 7.4**: Playwright e2e
  - Description: `e2e/syncdb.spec.ts` per repo E2E rules (loginAs helper in beforeEach, testID selectors, no waitForTimeout): offline create → banner shows queued → reconnect → synced; conflict flow via dev panel; encrypted-at-rest smoke (raw IndexedDB blob contains no todo-title plaintext); **user-switch wipe (AC-7)** — user B sees none of user A's data and A's queued mutation is not replayed as B.
  - Files: `example-frontend/e2e/syncdb.spec.ts` (new), e2e helpers as needed
  - Depends on: 7.3
  - Acceptance: e2e suite green in CI with USE_SYNCDB on.

- [ ] **Task 7.5**: Docs + migration guide + rtk deprecation note
  - Description: `syncdb/README.md` (architecture, usage, key management, multi-tenant scoping, the Yjs door); `docs/how-to/migrate-rtk-to-syncdb.md` (auth → Better Auth, reads, writes, offline, realtime equivalents); deprecation note in `rtk/README.md` scoped to data-sync concerns; package list updates in root `CLAUDE.md`/README.
  - Files: `syncdb/README.md` (new), `docs/how-to/migrate-rtk-to-syncdb.md` (new), `rtk/README.md`, `CLAUDE.md`
  - Depends on: 7.2
  - Acceptance: docs lint passes; migration guide covers every rtk data-sync concern with a syncdb equivalent.

- [ ] **Task 7.6**: Close PR #835
  - Description: Close #835 with a comment linking this plan and crediting the harvested pieces (outbox state machine, AES-GCM codec, delta applier, type contracts).
  - Files: none (GitHub action)
  - Depends on: IP PR merged
  - Acceptance: #835 closed with the comment posted.
