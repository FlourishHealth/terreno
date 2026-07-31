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

- [x] **Task 2.0**: Extract transport-agnostic CRUD executors from modelRouter
  - Description: **The load-bearing refactor of this IP.** modelRouter's create/update/delete logic is currently inline inside Express `asyncHandler` closures with permissions/validation as middleware (`api/src/api.ts:648-745` and onward) — no callable write path exists. Extract `executeCreate/executeUpdate/executeDelete({model, options, user, body, id, concurrencyCheck})` that run permissions, pre/post hooks, and validation without `req`/`res`; migrate the REST handlers to thin wrappers over them. `executeUpdate`'s concurrency check accepts either the legacy `If-Unmodified-Since` timestamp (REST) or a `baseSeq` integer (sync) so both LWW modes share one code path.
  - Files: `api/src/executors.ts` (new) or `api/src/api.ts` (extract in place), `api/src/index.ts`
  - Depends on: none (can start immediately; blocks 2.1)
  - Acceptance: **the entire existing @terreno/api test suite passes unchanged**; new unit tests drive each executor directly (no HTTP) covering permission denial, hook invocation order, and validation failure.

- [x] **Task 2.1**: Shared mutation handler + SyncMutation idempotency ledger
  - Description: `applySyncMutation({user, mutation})` that (a) **atomically claims** the mutation by inserting a `SyncMutation` row with status `pending` (unique index on mutationId) *before* applying — a dup-key error means another delivery owns/completed it, so wait/read back the recorded outcome instead of re-applying (closes the concurrent socket-retry + HTTP-fallback race); (b) executes create/update/delete through the Task 2.0 executors (permissions, pre/post hooks, validation); (c) passes `baseVersion` as the executor's `baseSeq` concurrency check — mismatch yields a conflict outcome carrying the canonical serialized doc + seq; (d) finalizes the ledger row with the outcome (TTL 30d).
  - Files: `api/src/sync/mutationHandler.ts` (new), `api/src/sync/models.ts`
  - Depends on: 1.2, 2.0
  - Acceptance: unit tests — successful apply; duplicate mutationId returns recorded outcome without re-applying; **two concurrent deliveries of the same mutationId apply exactly once**; conflict on stale baseVersion includes server doc; permission denial → unauthorized outcome; validation failure → validation outcome.

- [x] **Task 2.2**: `POST /sync/mutate` HTTP endpoint
  - Description: Thin route over `applySyncMutation`: 200 with ack body; 409 with nack body for conflicts; 403/422 mapped to `unauthorized`/`validation` nack codes.
  - Files: `api/src/sync/routes.ts`
  - Depends on: 2.1
  - Acceptance: API tests mirror all 2.1 outcomes over HTTP with correct status codes.

- [x] **Task 2.3**: Socket `sync:mutate`/`sync:ack`/`sync:nack` + `sync:subscribe` with tenant rooms
  - Description: Socket handlers calling `applySyncMutation` and replying ack/nack. `sync:subscribe {collections}` resolves the user's streams: owner scope reuses `user:{id}` room membership; tenant scope joins `sync:{stream}` rooms via a new `getUserStreams(user)` config callback on the sync plugin; broadcast uses the model room. Per-socket subscription caps consistent with existing handlers.
  - Files: `api/src/sync/socketHandlers.ts` (new), `api/src/realtime/realtimeApp.ts` (install hook), `api/src/sync/syncApp.ts`
  - Depends on: 2.1
  - Acceptance: integration tests with a socket.io client — mutate→ack roundtrip; conflict→nack with server doc; subscribe joins correct rooms per scope type; cap enforcement.

- [x] **Task 2.4**: `sync:delta` emission from the change-stream watcher
  - Description: Extend `changeStreamWatcher` so sync-registered models also emit `sync:delta {collection, id, method, data?, seq, stream, deleted?}` to the stream's rooms with per-socket permission checks (reuse `emitToAuthorizedRoom`). `seq`/`stream` are read from the post-image (`fullDocument._syncSeq`; the watcher runs `updateLookup`, `changeStreamWatcher.ts:419`). Scope changes use the **`_syncPrevStream` field stamped by the 1.2 plugin** (change streams run `fullDocumentBeforeChange: "off"`, so the old scope is not otherwise available): when post-image `_syncPrevStream` differs from the current stream, emit a tombstone delta to the previous stream + a create delta to the new stream. `realtime` and `sync` may coexist on a model: distinct event names, double emission accepted, documented as transitional.
  - Files: `api/src/realtime/changeStreamWatcher.ts`, `api/src/sync/streams.ts`
  - Depends on: 2.3 (and 1.2's `_syncPrevStream`)
  - Acceptance: integration tests — create/update/soft-delete each produce exactly one delta with correct seq on the right stream; tenant A's socket never receives tenant B's delta; scope-move emits tombstone+create pair **without Mongo pre-images enabled**; a model with both `realtime` and `sync` emits both event types with no cross-talk.

- [x] **Task 2.5**: Pluggable socket authenticator (Better Auth support)
  - Description: Refactor `RealtimeApp`'s hardcoded `@thream/socketio-jwt` middleware into an authenticator chain: legacy JWT validator (default, behavior unchanged) plus a Better Auth session-token validator (validates via Better Auth session lookup and populates the same `socket.decodedToken` shape consumed by `getSocketUser`).
  - Files: `api/src/realtime/socketAuth.ts` (new), `api/src/realtime/realtimeApp.ts`, `api/src/realtime/socketUser.ts`
  - Depends on: none (parallel with 2.1–2.4)
  - Acceptance: tests — legacy JWT connects exactly as before; Better Auth session token connects and resolves the same user identity; invalid tokens rejected.

## Phase 3: Client core (@terreno/syncdb)

- [x] **Task 3.1**: Package scaffold
  - Description: New workspace package `syncdb/` (`@terreno/syncdb`): tsconfig, biome, bun test setup; deps `tinybase` + `luxon` (catalog where available); optional peers `expo-sqlite`, `react`, `socket.io-client`. Root scripts (`syncdb:compile` etc.) and inclusion in `compile`/`lint`/`test`/bootstrap pipelines.
  - Files: `syncdb/package.json` (new), `syncdb/tsconfig.json` (new), `syncdb/biome.jsonc` (new), `syncdb/src/index.ts` (new), root `package.json`
  - Depends on: none
  - Acceptance: `bun run bootstrap:update` compiles the package; empty test suite runs green; lint passes.

- [x] **Task 3.2**: MergeableStore schema + typed entity accessors
  - Description: `createSyncStore({collections})` building a `MergeableStore` with the documented table layout (`{collection}`, `_outbox`, `_cursors`, `_conflicts`; values `schemaVersion`, `lastUserId`); typed accessors: upsert/get/list/softDelete/clear per collection with JSON `data` cell round-tripping. Harvest/adapt `storage/store.ts` + `storage/schema.ts` from PR #835.
  - Files: `syncdb/src/storage/store.ts` (new), `syncdb/src/storage/schema.ts` (new), `syncdb/src/storage/types.ts` (new)
  - Depends on: 3.1
  - Acceptance: unit tests — accessor round-trips, tombstone filtering in list, per-collection isolation.

- [x] **Task 3.3**: Outbox state machine
  - Description: Durable outbox on the `_outbox` table with lifecycle `queued→inFlight→acked|conflicted|failed`, FIFO per collection, attemptCount, and per-user isolation (mutations record userId; replay skips mismatches — semantics ported from `rtk/src/offlineMiddleware.ts:96-107`). Harvest/adapt `mutations/outbox.ts` from #835.
  - Files: `syncdb/src/mutations/outbox.ts` (new)
  - Depends on: 3.2
  - Acceptance: unit tests — every legal/illegal state transition, FIFO ordering, user-isolation skip.

- [x] **Task 3.4**: Cursor store + idempotent delta applier
  - Description: `_cursors` accessors + `applyDelta(delta)`: ignore if `delta.seq <= entity.seq` (idempotent); apply create/update/tombstone; advance the cursor **keyed by `delta.stream`** (a socket interleaves deltas from multiple independent streams/counters); report seq jumps (`delta.seq > cursor(delta.stream) + 1`) as a *reconcile hint* — jumps are legitimate when permission-filtered deltas skip seqs, so the hint is rate-limited downstream, never treated as proof of loss. Never overwrite an entity that has a pending outbox mutation (optimistic state protected; conflict resolution decides). Harvest/adapt `sync/cursor.ts` + `sync/deltaApplier.ts` from #835.
  - Files: `syncdb/src/sync/cursor.ts` (new), `syncdb/src/sync/deltaApplier.ts` (new)
  - Depends on: 3.3
  - Acceptance: unit tests — idempotency on duplicate/out-of-order deltas, pending-entity protection, seq-jump reporting, tombstone application.

- [x] **Task 3.5**: Persister factories (expo-sqlite, memory, platform resolution)
  - Description: `persisterFactory` abstraction; native default via TinyBase `ExpoSqlitePersister` (JSON mode); in-memory persister for tests/SSR; platform resolution via `.native.ts`/`.web.ts` files (web default lands in Task 4.2).
  - Files: `syncdb/src/persisters/types.ts` (new), `syncdb/src/persisters/memoryPersister.ts` (new), `syncdb/src/persisters/defaultPersisterFactory.ts` (+ `.native.ts`, `.web.ts`) (new)
  - Depends on: 3.2
  - Acceptance: unit tests — memory persister save/load round-trips a MergeableStore including outbox rows.

## Phase 4: Client crypto

- [x] **Task 4.1**: AES-GCM payload codec
  - Description: `PayloadCodec` interface + AES-256-GCM implementation over Web Crypto (`crypto.subtle`), fresh IV per encrypt, versioned envelope `{v, iv, ciphertext}`. Harvest/adapt `crypto/aesGcmCodec.ts` from #835.
  - Files: `syncdb/src/crypto/types.ts` (new), `syncdb/src/crypto/aesGcmCodec.ts` (new)
  - Depends on: 3.1
  - Acceptance: unit tests — round-trip, tamper detection (auth tag failure), distinct IVs per encrypt.

- [x] **Task 4.2**: EncryptedIndexedDbPersister (web default, encryption on)
  - Description: `createCustomPersister` that serializes mergeable content, encrypts via the codec, and stores a single blob in IndexedDB; decrypt-on-load with corrupt/undecryptable data treated as an empty store + `onDecryptFailure` callback (triggers wipe + re-bootstrap). Debounced saves (500ms trailing). Becomes the web default persister factory.
  - Files: `syncdb/src/persisters/encryptedIndexedDbPersister.ts` (new), `syncdb/src/persisters/defaultPersisterFactory.web.ts`
  - Depends on: 4.1, 3.5
  - Acceptance: unit tests (fake-indexeddb) — round-trip; encrypted-at-rest assertion (raw IDB blob contains no plaintext entity markers); decrypt-failure path invokes callback and yields empty store.

- [x] **Task 4.3**: Key providers
  - Description: `KeyProvider` interface; `serverKeyProvider` (default): fetch `GET /sync/key`, HKDF-derive an AES-256-GCM key (salt = `{name}:{userId}`), import as a non-extractable CryptoKey, cache in IndexedDB for offline cold start, wipe+re-bootstrap on rotation-induced decrypt failure; `localKeyProvider`: generate + store a non-extractable CryptoKey locally.
  - Files: `syncdb/src/crypto/keyProviders.ts` (new)
  - Depends on: 4.1
  - Acceptance: unit tests — deterministic derivation from the same material; cached key reused without network; local provider persists across fresh module init against the same fake IDB.

- [x] **Task 4.4**: Wipe-on-user-change
  - Description: Client watches `authProvider.onAuthChange`; when userId differs from stored `lastUserId`, destroy persisted data, reset the store, clear cached keys, and re-bootstrap.
  - Files: `syncdb/src/client.ts`
  - Depends on: 4.3 (implemented alongside 5.4 client assembly)
  - Acceptance: unit test — user switch wipes entities/outbox/cursors/conflicts and updates `lastUserId`.

## Phase 5: Client sync engine + transport

- [x] **Task 5.1**: SyncTransport interface + Socket.io transport
  - Description: `SyncTransport` contract (connect/disconnect, subscribe, sendMutation→ack/nack promise with timeout, onDelta, onStatusChange). Socket.io implementation speaking the Phase 2 protocol with reconnection and auth-token refresh patterns modeled on `rtk/src/socket.ts`. `authProvider.getToken()` is called per connection attempt and per HTTP request (never cached by the transport) so Better Auth session refresh is picked up transparently; a 401 mid-replay or mid-bootstrap pauses and retries once after the next `onAuthChange`. Keep a `fakeTransport` for tests (harvest `sync/types.ts` + `sync/fakeTransport.ts` from #835).
  - Files: `syncdb/src/sync/types.ts` (new), `syncdb/src/sync/socketTransport.ts` (new), `syncdb/src/sync/fakeTransport.ts` (new)
  - Depends on: 3.4
  - Acceptance: unit tests against fakeTransport (send/ack/nack/timeout, delta delivery); socket transport exercised end-to-end in 5.5.

- [x] **Task 5.2**: HTTP bootstrap + fallback mutation channel
  - Description: `bootstrap({collections})` paging `GET /sync/snapshot` per stream through the delta applier; HTTP `POST /sync/mutate` fallback used when the socket is unavailable; reconcile = snapshot-from-cursor.
  - Files: `syncdb/src/sync/bootstrap.ts` (new), `syncdb/src/sync/httpChannel.ts` (new)
  - Depends on: 5.1
  - Acceptance: unit tests — multi-page bootstrap advances each stream cursor exactly once; HTTP fallback engaged when socket down.

- [x] **Task 5.3**: Replay coordinator
  - Description: FIFO-per-collection outbox flush: mark inFlight → send → ack finalizes (clear `pendingMutationId`, apply server seq); conflict-nack records a `_conflicts` entry and pauses that entity; unauthorized-nack pauses replay until auth change; error-nack retries with backoff then failed. Triggered on start, reconnect, auth restore, and new enqueue. Harvest/adapt `sync/replayCoordinator.ts` from #835.
  - Files: `syncdb/src/sync/replayCoordinator.ts` (new)
  - Depends on: 5.1
  - Acceptance: unit tests — each ack/nack path, FIFO ordering under interleaved enqueues, backoff, auth-pause/resume.

- [x] **Task 5.4**: Conflict resolver + reconcile heuristics + client assembly
  - Description: `resolveConflict({mutationId, strategy})` — `useServer`: apply server doc, drop mutation; `keepMine`: re-enqueue with fresh baseVersion. Reconcile triggers: reconnect, seq-jump hints (**rate-limited to once per 30s per stream** — jumps can be legitimate permission-filtered gaps), and a **periodic reconcile** (visibility change / every few minutes while connected) so deltas missed with no observable jump still converge. Assemble `createSyncDb`: start/stop, mutate (local apply + enqueue + flush), getSyncStatus, wipe-on-user-change (4.4). On web, guard persister saves with the Web Locks API (single-writer across tabs; non-holders stay in-memory) to prevent multi-tab blob clobbering losing outbox rows.
  - Files: `syncdb/src/mutations/resolveConflict.ts` (new), `syncdb/src/client.ts` (new), `syncdb/src/index.ts`
  - Depends on: 5.2, 5.3, 4.3
  - Acceptance: unit tests — both strategies, status aggregation, seq-jump triggers rate-limited reconcile, periodic reconcile fires, second concurrent client instance does not clobber the persisted outbox.

- [x] **Task 5.5**: End-to-end integration test against a real backend
  - Description: bun integration test spinning up a TerrenoApp (via `@terreno/test` in-memory Mongo replica set) with a synced model; syncdb client (memory persister + socket transport) performs: bootstrap; live delta receipt; offline mutate → replay → ack; stale-base conflict → nack → resolve both ways; duplicate mutationId idempotency.
  - Files: `api/src/sync/integration.test.ts` (new — lives in the api package by decision: the test needs TerrenoApp + `@terreno/test` Mongo, and syncdb must stay free of backend devDependencies; syncdb is consumed as a workspace dep of the test)
  - Depends on: 5.4, Phase 2 complete
  - Acceptance: all listed scenario assertions pass in CI.

## Phase 6: React layer + Better Auth adapter

- [x] **Task 6.1**: SyncDbProvider + hooks
  - Description: `SyncDbProvider client={...}`; hooks over TinyBase reactive listeners: `useEntity`, `useQuery` (filter/sort in JS with memoization), `useMutate`, `useSyncStatus`, `useConflicts`. React Native Web compatible. Harvest/adapt `react/hooks.ts` + `react/provider.tsx` from #835.
  - Files: `syncdb/src/react/provider.tsx` (new), `syncdb/src/react/hooks.ts` (new)
  - Depends on: 5.4
  - Acceptance: hook tests (@testing-library/react-native) — re-render on local write and on applied delta; status and conflict reactivity.

- [x] **Task 6.2**: Better Auth AuthProvider adapter
  - Description: `betterAuthAdapter(authClient)` implementing `{getToken, getUserId, onAuthChange}` against the Better Auth client used in-repo (`rtk/src/betterAuthClient.ts` / admin-spa pattern).
  - Files: `syncdb/src/auth/betterAuthAdapter.ts` (new), `syncdb/src/auth/types.ts` (new)
  - Depends on: 3.1
  - Acceptance: unit tests with a stubbed Better Auth client — token/userId passthrough, auth-change fan-out.

## Phase 7: Example integration + docs

- [x] **Task 7.1**: example-backend sync enablement
  - Description: Add `sync: {scope: {type: "owner"}}` to the todos router; **refactor `bulkComplete` off `Todo.updateMany`** (`example-backend/src/api/todos.ts:22`) to a per-doc loop — `updateMany` throws on synced models per Task 1.2; add a tenant-scoped example model (`projects` with `organizationId`) demonstrating `{type: "tenant"}` + `getUserStreams`; seed data for both.
  - Files: `example-backend/src/api/todos.ts`, `example-backend/src/models/project.ts` (new), `example-backend/src/api/projects.ts` (new), `example-backend/src/server.ts`, seed script
  - Depends on: Phase 2
  - Acceptance: backend boots; `bulkComplete` still works and every affected todo gets a fresh `_syncSeq`; snapshot/mutate/delta verified against todos + projects; OpenAPI snapshot updated.

- [x] **Task 7.2**: example-frontend syncdb integration behind USE_SYNCDB
  - Description: Create the syncdb client (Better Auth adapter, default persisters/key provider); re-implement the Todos screen data layer on `useQuery`/`useMutate` behind the `USE_SYNCDB` OpenFeature flag (verify the example-frontend flag plumbing via `useTerrenoFeatureFlags` exists for this flag; add it if missing); flag off = RTK path unchanged.
  - Files: `example-frontend/store/syncdb.ts` (new), `example-frontend/app/(tabs)/index.tsx`, `example-frontend/app/_layout.tsx`
  - Depends on: Phase 6, 7.1
  - Acceptance: flag on — todos CRUD works offline-first (offline create appears instantly, syncs on reconnect); flag off — RTK behavior unchanged.

- [x] **Task 7.3**: SyncStatusBanner + ConflictSheet + dev panel
  - Description: Banner (`sync-status-banner`, `sync-queued-count`, `sync-conflict-badge`); conflict sheet (`conflict-sheet`, `conflict-item-{id}`, `conflict-keep-mine-button`, `conflict-use-server-button`); dev-only panel (`syncdb-dev-panel`, `syncdb-offline-toggle`, `syncdb-wipe-button`). All from @terreno/ui primitives.
  - Files: `example-frontend/components/SyncStatusBanner.tsx` (new), `example-frontend/components/ConflictSheet.tsx` (new), `example-frontend/components/SyncDevPanel.tsx` (new)
  - Depends on: 7.2
  - Acceptance: manual verification per acceptance criteria; all testIDs present.

- [x] **Task 7.4**: Playwright e2e
  - Description: `e2e/syncdb.spec.ts` per repo E2E rules (loginAs helper in beforeEach, testID selectors, no waitForTimeout): offline create → banner shows queued → reconnect → synced; conflict flow via dev panel; encrypted-at-rest smoke (raw IndexedDB blob contains no todo-title plaintext); **user-switch wipe (AC-7)** — user B sees none of user A's data and A's queued mutation is not replayed as B.
  - Files: `example-frontend/e2e/syncdb.spec.ts` (new), e2e helpers as needed
  - Depends on: 7.3
  - Acceptance: e2e suite green in CI with USE_SYNCDB on.

- [x] **Task 7.5**: Docs + migration guide + rtk deprecation note
  - Description: `syncdb/README.md` (architecture, usage, key management, multi-tenant scoping, the Yjs door); `docs/how-to/migrate-rtk-to-syncdb.md` (auth → Better Auth, reads, writes, offline, realtime equivalents); deprecation note in `rtk/README.md` scoped to data-sync concerns; package list updates in root `CLAUDE.md`/README.
  - Files: `syncdb/README.md` (new), `docs/how-to/migrate-rtk-to-syncdb.md` (new), `rtk/README.md`, `CLAUDE.md`
  - Depends on: 7.2
  - Acceptance: docs lint passes; migration guide covers every rtk data-sync concern with a syncdb equivalent.

- [ ] **Task 7.6**: Close PR #835
  - Description: Close #835 with a comment linking this plan and crediting the harvested pieces (outbox state machine, AES-GCM codec, delta applier, type contracts).
  - Files: none (GitHub action)
  - Depends on: IP PR merged
  - Acceptance: #835 closed with the comment posted.

## Phase 8: Hardening (per `docs/implementationPlans/terreno-syncdb-2.md`)

*Status verified by deep review on 2026-07-31. All six hardening phases are implemented on `worktree-ip-syncdb`; the two noted deviations carry forward as Phase 9 tasks.*

- [x] **Phase A — Client replay correctness & scheduling**: startup recovery (`outbox.recoverStartupState`), send-time baseVersion refresh, drain-until-empty scheduler with timed wake-ups + jittered backoff, separate transport-failure vs error-nack budgets (`errorNackCount` column), auth-pause pipeline (`paused: "auth"`, `onAuthRequired`, one-shot `refresh()`, `wipeOnSignOut` + `client.signOut()`), outbox pruning + O(1) `enqueueOrder` via `_meta` cell.
- [x] **Phase B — Ordered batch protocol**: `SyncMutateBatchRequest/Response` on both sides, `applySyncMutationBatch` (strict serial, stop-on-first-non-ack), `POST /sync/mutate/batch` + `sync:mutateBatch`, client batched drain (≤1 mutation/entity per chunk), `batchUnsupported` fallback, `haltQueueOnConflict`, `retryFailed`, B5 `SyncStatus` fields + banner states. (Reference app does not wire all banner props — Task 9.22.)
- [x] **Phase C — Server protocol correctness**: C1 stable frontier (`computeStableFrontier`, `syncFrontier.test.ts`), C2 per-stream cursors + `GET /sync/streams` with join-backfill/leave-purge, C3 `legacyCursor` seq-0 paging, C4 durable `SyncScopeMove` markers, C5 ledger lease takeover, C6 write-scope enforcement + snapshot read parity + upsert guard, C7 `compactTombstones` + `oldestRetainedSeq`, C8 minor batch. (Frontier/marker/pagination edge cases found in review — Tasks 9.4–9.6.)
- [x] **Phase D — Auth & security**: D1 session re-validation sweep, D2 full user cached on `socket.data.fullUser`, D3 tenant `preCreate` hardening in example-backend, D4 room revocation on sweep, D5 password-set audit logging.
- [x] **Phase E — Client storage & React**: E1 lifecycle generation counter + promise-chain mutex, E2 schema-version wipe, E3 persistence failure surfacing (`persistence` status, `onDecryptFailure`), E4 transaction-batched page/delta application + `useQuery` null-data guard, E5 client tombstone compaction, E6 UI minor batch. (E1's Playwright follow-up — relaxing the serial-file workaround — not done: Task 9.24.)
- [x] **Phase F — Test & load infrastructure**: F1 integration additions (socket drop mid-batch, token expiry mid-session, two-device convergence, lost-ack replay), F2 `loadHarness.ts` + `api:load`, F3 chaos proxy + `syncdb-chaos.spec.ts`, F4 `syncdb-loadlab.spec.ts` (`@load`, nightly), F5 resolved via the documentation option (`rtk/README.md` deprecation notice) — needs explicit repo-owner sign-off (Task 9.26).

## Phase 9: Deep-review follow-ups (2026-07-31)

*Findings from a full review of PR #869 against the intent of both IPs and the architecture. Every task is independently implementable. Severity ordering: 9.1–9.9 are merge-blocking (broken CI, cross-user identity leak, frontier holes); 9.10–9.18 are correctness edge cases; 9.19–9.21 security; 9.22–9.24 example app + e2e; 9.25–9.27 cleanup; 9.28–9.29 docs. File/line references are to the PR head at review time — locate by the described code.*

### 9.A Merge blockers

- [ ] **Task 9.1**: Fix the e2e CI workflow (duplicate `if:` key) and get the E2E matrix running
  - Description: `.github/workflows/e2e-ci.yml` has two `if: ${{ github.actor != 'dependabot[bot]' }}` keys on the `e2e` job (lines ~30 and ~32). GitHub rejects the workflow, so **zero e2e jobs run on this branch** (confirmed on PR #869 — no E2E checks appear at all). Master already carries a fix; merge master or delete the duplicate line.
  - Files: `.github/workflows/e2e-ci.yml`
  - Depends on: none
  - Acceptance: E2E matrix jobs appear and execute on the PR. Expect them to surface Task 9.3.

- [ ] **Task 9.2**: Fix the 6 failing RTK tests on this branch's CI
  - Description: `RTK Lint and Build` fails on `worktree-ip-syncdb` (passes on master). Failing: `listener middleware side effects > stores tokens in AsyncStorage on web login…`, `…re-throws and logs when AsyncStorage.setItem fails…`, `…removes tokens from AsyncStorage on web logout…`, `getAuthToken > reads AUTH_TOKEN from AsyncStorage when window exists`, `createBetterAuthClient > hands the plugin a storage that repairs the jar…`, `offlineMiddleware > uses list-cache updated timestamp for queued update conflict headers`. Branch-correlated, so likely a dependency/catalog or test-setup interaction introduced by syncdb-era changes, not flake.
  - Files: `rtk/src/*`, root `package.json` catalog, rtk test setup
  - Depends on: none
  - Acceptance: `RTK Lint and Build` green on the PR; root cause noted in the commit message.

- [ ] **Task 9.3**: Fix e2e specs targeting the nonexistent `todos-completed-section` testID
  - Description: `syncdb-offline.spec.ts` (~83–115), `syncdb-conflicts.spec.ts` (~88, 145), `todos.spec.ts` (~42, 67), and `realtime.spec.ts` (~80) select `page.getByTestId("todos-completed-section")…` but no component renders that testID on this branch (master's screen had only `todos-completed-section-toggle`; `SyncTodosScreen` flattens sections into FlashList rows via a `SectionHeader` that is not a container, so nested `getByTestId` scoping cannot work). These specs cannot pass — masked until 9.1 lands. Rewrite the assertions to check completion state directly (e.g. `todo-toggle-${id}` checked state or a `data-completed` marker per row); do not add a wrapping container inside FlashList.
  - Files: `example-frontend/e2e/syncdb-offline.spec.ts`, `syncdb-conflicts.spec.ts`, `todos.spec.ts`, `realtime.spec.ts`, `example-frontend/components/SyncTodosScreen.tsx`
  - Depends on: 9.1
  - Acceptance: all four specs green in the CI matrix.

- [ ] **Task 9.4**: Client — bounce the transport on user switch (cross-user identity leak)
  - Description: The socket authenticates per connection (token read inside the Socket.io `auth` callback). `handleAuthChange`'s different-user branch wipes local data via `runUserCheck` but never disconnects/reconnects the transport — `transport.connect/disconnect` are only called from `start()`/`stop()`/`goOffline()`/`goOnline()` (verified). While the old socket lives: (a) the server keeps pushing the OLD user's `sync:delta`s into the NEW user's freshly wiped store (`handleDelta` has no user guard); (b) `sendMutation` prefers the connected socket, so the new user's mutations are attributed to the old identity until the D1 sweep kills the socket. Force a transport bounce (disconnect → connect → resubscribe) in the different-user branch and after a wipe in `start()`.
  - Files: `syncdb/src/client.ts` (`handleAuthChange`, `runUserCheck`), `syncdb/src/client.test.ts`
  - Depends on: none
  - Acceptance: client test asserting the fake transport observes disconnect+reconnect on user switch, and that a delta delivered on the stale connection after the switch never lands in the new user's store.

- [ ] **Task 9.5**: Client — `useQuery`/`useEntityIds` return stale results when options change
  - Description: `optionsRef` is written in a `useLayoutEffect`, but the memoized `select` only depends on `[client, collection]` and `useCachedExternalStore` reuses the cached value while `cached.select === select && cached.revision === revision` (revision bumps only on store changes). A render that changes `filter`/`sort`/`includeDeleted` (e.g. a `showCompleted` toggle) silently returns the previous array until an unrelated store write — the most common React pattern (state-driven filters) breaks in a way that looks like sync lag. Invalidate the cache on options change (options revision bumped in the layout effect, or key the cache on an options token).
  - Files: `syncdb/src/react/hooks.ts` (`useCachedExternalStore` ~63–86, `useQuery` ~174–215, `useEntityIds` ~236–270), `syncdb/src/react/hooks.test.tsx`
  - Depends on: none
  - Acceptance: hooks test flipping the filter between renders **without any store write** sees the new result immediately; existing referential-stability tests still pass.

- [ ] **Task 9.6**: Server — `insertMany` confirms seqs before commit, breaching the C1 frontier
  - Description: `syncSeqPlugin`'s `pre("insertMany")` (~247–262) claims AND confirms seqs inside the pre hook, before the documents commit. Once confirmed, `computeStableFrontier` includes those seqs; a snapshot can advance a cursor past them while the docs are still uncommitted → the docs land permanently below every catch-up cursor (`loadtest.ts` generate widens the window to 5k docs). Move the confirm to `post("insertMany")` (mirror the save path), and pass the caller's session through the claim.
  - Files: `api/src/sync/syncSeqPlugin.ts`, `api/src/sync/syncFrontier.test.ts`
  - Depends on: none
  - Acceptance: test racing a snapshot into the claim→commit window (deterministic via stubbed `confirmSyncSeqs` ordering) shows the cursor never passes unconfirmed insertMany seqs; frontier property test extended to drive `insertMany`.

- [ ] **Task 9.7**: Server — scope-move marker durability on both write paths
  - Description: Two halves. (a) `pre("save")` writes the `SyncScopeMove` marker (with an immediately confirmed old-stream seq) BEFORE the document write commits — a failing save (E11000, VersionError) leaves a durable phantom tombstone that old-stream clients apply, deleting a live doc locally. Move the marker write to a post-commit hook like the query path. (b) The query path's `postQueryWrite` (~397–402) swallows marker-write failures with only `logger.error` — a real move can permanently lack its tombstone (the exact race C4 exists to eliminate). Retry, or backfill from the still-stamped `_syncPrevStream` via a sweep/compaction pass.
  - Files: `api/src/sync/syncSeqPlugin.ts`, `api/src/sync/syncPhaseC.test.ts`
  - Depends on: none
  - Acceptance: failing save leaves no `SyncScopeMove` row; a marker-write failure on the query path is retried or backfilled (test with a stubbed failing insert).

- [ ] **Task 9.8**: Server — snapshot cursor stalls when a full page is permission-denied
  - Description: `routes.ts` (~441–481) derives `nextCursor` from the last INCLUDED entity; denied docs are dropped. If every doc in a full page fails the per-doc `read` check, `entities` is empty, `nextCursor === cursor`, `hasMore` stays true → the client loops forever. The M2 comment says "still advance the cursor past them" but the code doesn't for trailing/whole-page denials (existing test only covers a denied doc in the middle). Advance the cursor from the last doc of the RAW fetched page (min'd with consumed marker seqs and `frontierSeq`).
  - Files: `api/src/sync/routes.ts`, `api/src/sync/syncPhaseC.test.ts`
  - Depends on: none
  - Acceptance: test with >limit contiguous denied docs — bootstrap terminates; cursor advances past denied strata; no denied doc is ever leaked.

- [ ] **Task 9.9**: Server — ensure sync indexes at startup (`ensureSyncIndexes` has no caller)
  - Description: The idempotency ledger's unique `mutationId` index and `SyncCounter.stream`'s unique index exist only via schema `unique: true` (dependent on `autoIndex`, commonly off in production). Without them, duplicate deliveries double-apply (INV-3 gone) and the counter upsert race mints duplicate seqs. Additionally, `ensureSyncIndexes()` (the C8 fail-loudly mechanism) is exported but never called by `SyncApp.register`, `TerrenoApp`, or `setupServer` (verified — only its own test references it). Wire `SyncApp.register` (or `TerrenoApp.start`) to await `ensureSyncIndexes()` plus `ensureIndexes()` on `SyncCounter`/`SyncMutation`/`SyncScopeMove`/`SyncKey`, and document the requirement.
  - Files: `api/src/sync/syncApp.ts`, `api/src/sync/registry.ts`, `api/src/sync/models.ts`, startup integration test
  - Depends on: none
  - Acceptance: startup-integration test proves the indexes exist after `register` without manual `ensureIndexes()` calls in test setup; index-build failure fails startup loudly.

### 9.B Correctness edge cases

- [ ] **Task 9.10**: Client — unify the auth-pause pipeline (same-user check, silent refresh everywhere, `signOut` hygiene)
  - Description: Four related defects in one cluster. (a) `attemptAuthRecovery` unpauses and replays after `refresh()` without verifying the resolved userId equals `currentUserId` — a different user signing in from another tab can drain the OLD user's outbox under the NEW user's token (INV-2). (b) The one-shot silent refresh is wired only through the coordinator's `onAuthPause`; reconcile-401s, `sync:auth-expired`, and other `setAuthPaused(true)` call sites skip it — move the trigger inside `setAuthPaused(true)` (idempotent per episode) and delete per-call-site wiring. (c) `signOut()` bypasses `withLifecycle`/generation and leaves the destroyed persister assigned — wrap it in the mutex, bump generation, clear the module-level `persister`. (d) `signOut({wipeOnSignOut})`'s wipe omits `keyCacheDbNames: [DEFAULT_KEY_CACHE_DB_NAME]` unlike the other two wipe sites — the strongest wipe case keeps the cached CryptoKey.
  - Files: `syncdb/src/client.ts` (`attemptAuthRecovery` ~825, `setAuthPaused`, `signOut` ~1493), `syncdb/src/client.test.ts`
  - Depends on: none
  - Acceptance: tests — refresh resolving a different userId does NOT unpause; a 401 arriving via reconcile attempts exactly one silent refresh; `signOut` racing `handleAuthChange` is serialized; `signOut` wipe clears the key-cache DB.

- [ ] **Task 9.11**: Client — roll back rejected optimistic data; recover orphaned `pendingMutationId`
  - Description: (a) After a terminal (validation/error) nack, `handleTerminalFailure` releases the entity but `repairMarkedEntities` drops ids without a `_needsRepair` mark, and snapshot reconcile skips the entity (`seq` unchanged) — the server-rejected data persists locally indefinitely. Mark needs-repair unconditionally in the terminal path (or let `repairMarkedEntities` accept explicit entityIds, resolving the stream from the entity row). (b) An entity whose `pendingMutationId` references no outbox row is permanently frozen (delta applier skips, repair refuses) — add a startup sweep clearing pendings with no matching `_outbox` row.
  - Files: `syncdb/src/sync/replayCoordinator.ts` (`handleTerminalFailure`), `syncdb/src/sync/entityRepair.ts`, `syncdb/src/mutations/outbox.ts` (`recoverStartupState`), tests
  - Depends on: none
  - Acceptance: validation-nacked entity converges back to server state without any concurrent server write; a store persisted with an orphaned `pendingMutationId` accepts deltas again after `start()`. Document the resulting semantics in `syncdb/README.md` (pairs with Task 9.28).

- [ ] **Task 9.12**: Conflict protocol — represent "server deleted it" in `useServer` resolution
  - Description: `resolveConflict`'s `useServer` branch upserts `{data: serverData, seq}` with no `deleted` flag; when the conflict arose from a server-side delete (`serverDoc: null`), the result is a ghost live row (`data: null, deleted: false`) instead of a tombstone. Carry a `serverDeleted` flag on the nack/conflict row (server contract change), or at minimum treat `serverDoc === null && serverSeq > 0` as a tombstone.
  - Files: `syncdb/src/mutations/resolveConflict.ts`, `syncdb/src/mutations/conflicts.ts`, `syncdb/src/types.ts` + `api/src/sync/types.ts` (`SyncNack`), `api/src/sync/mutationHandler.ts`, tests both sides
  - Depends on: none
  - Acceptance: edit-vs-server-delete conflict resolved `useServer` yields a local tombstone; `useQuery`/`useEntity` never surface the ghost.

- [ ] **Task 9.13**: Server — make the `baseVersion` conflict check atomic (TOCTOU lost update)
  - Description: `executeUpdate` (~442–472) reads `doc._syncSeq`, compares, then `doc.save()` — two concurrent updates with the same `baseVersion` can both pass and both save; one edit is silently lost with acks to both clients. Enforce/require `optimisticConcurrency: true` on synced schemas at registration (mapping `VersionError` to the conflict nack), or re-verify `_syncSeq` in a conditional write.
  - Files: `api/src/sync/executors.ts`, `api/src/sync/registry.ts`, `api/src/sync/mutationHandler.test.ts`
  - Depends on: none
  - Acceptance: two-writers-same-baseVersion race test — exactly one ack, one conflict nack.

- [ ] **Task 9.14**: Server — legacy (seq-0) pagination breaks on string-`_id` models
  - Description: `pageLegacyStratum` (~routes.ts:200) always casts the legacy cursor via `new mongoose.Types.ObjectId(...)`. Synced models are designed around string `_id`s (client-minted ids): non-hex ids throw (500), and hex-shaped string ids compare across BSON types and match nothing — the stratum reports exhausted after one page and the remaining legacy docs are silently skipped forever. Cast only when the model's `_id` schema type is ObjectId; otherwise compare the raw string.
  - Files: `api/src/sync/routes.ts`, `api/src/sync/syncPhaseC.test.ts`
  - Depends on: none
  - Acceptance: string-`_id` model with >limit legacy docs bootstraps completely; existing ObjectId path regression-tested.

- [ ] **Task 9.15**: Server — real retention watermark; `SyncScopeMove` TTL honors `retentionDays`
  - Description: (a) `computeOldestRetainedSeq` uses min(retained doc/marker seq) — a live, never-touched early doc pins the floor low forever, so a stale cursor between a compacted tombstone's seq and head passes the check and never learns about the deletion. Have `compactTombstones` record a durable per-stream watermark (e.g. `compactedThroughSeq` on `SyncCounter` = max seq among deleted rows) and serve that. (b) `SYNC_SCOPE_MOVE_TTL_SECONDS` is hardcoded to 90d, ignoring per-model `retentionDays` — markers for long-retention models vanish early with no watermark update. Drop the TTL index and let `compactTombstones` be the only reaper (or set TTL to max configured retention).
  - Files: `api/src/sync/routes.ts` (`computeOldestRetainedSeq`), `api/src/sync/scripts/compactTombstones.ts`, `api/src/sync/models.ts`, end-to-end test
  - Depends on: none
  - Acceptance: the plan's demanded C7 test exists end-to-end — client with a cursor older than the compaction watermark re-bootstraps and converges (currently `oldestRetainedSeq` is only `typeof`-checked).

- [ ] **Task 9.16**: Server — change-stream restart with resume token
  - Description: `changeStreamWatcher` (~819–830) only logs on `error`/`close`; any transient failure (replica-set election, `ChangeStreamHistoryLost`) permanently kills all delta emission until process restart, silently starving online clients. Re-create the stream with backoff using the last-seen resume token (`resumeAfter`); on unresumable history loss, emit a resync hint to connected sockets.
  - Files: `api/src/realtime/changeStreamWatcher.ts`, new test
  - Depends on: none
  - Acceptance: test — simulated stream error → watcher resumes and subsequent writes still emit `sync:delta`; history-lost path emits the resync hint.

- [ ] **Task 9.17**: Server — detect reaped-lease slow writers in `confirmSyncSeqs`
  - Description: A writer stalling >60s (not crashed) has its pending claim reaped; the frontier advances; its later commit lands below every cursor — currently silent because `confirmSyncSeqs` ignores the `$pull` result. When the confirm matched zero entries for a `registered` claim, re-stamp the doc with a freshly claimed seq (preferred) or at minimum `logger.error` with stream/seq for operator visibility.
  - Files: `api/src/sync/models.ts` (`confirmSyncSeqs`), `api/src/sync/syncSeqPlugin.ts`, test
  - Depends on: none
  - Acceptance: test simulating a reap-then-confirm shows the doc re-stamped above the frontier (or the loud error path exercised and documented as accepted risk).

- [ ] **Task 9.18**: Server — transient `error` outcomes are sticky per `mutationId` for 30 days
  - Description: `finalizeNack` records transient executor failures (DB hiccup) as `failed`; every replay of the same mutationId returns the recorded nack — the durable client outbox retries pointlessly and never re-mints. Delete the pending row (instead of finalizing) for non-deterministic `error`-class failures so a retry re-executes, or explicitly document the re-mint contract client-side and implement it. Related: `mongoose.model(entry.modelName)` sits outside the `try` in `applyClaimedMutation` (~453) — a throw wedges the row `pending` for the lease window; move it inside.
  - Files: `api/src/sync/mutationHandler.ts`, `syncdb/src/sync/replayCoordinator.ts` (if the re-mint contract is chosen), tests
  - Depends on: none
  - Acceptance: a mutation that failed on a transient error succeeds on replay without a new mutationId (or the documented alternative is implemented and tested).

### 9.C Security

- [ ] **Task 9.19**: Server — snapshot/entities must honor `queryFilter` (C6/M2 requirement)
  - Description: `rg queryFilter api/src/sync/` returns nothing — the snapshot and `GET /sync/entities` build only scope + seq filters. The common REST pattern (`read: [IsAuthenticated]` + `OwnerQueryFilter` doing the real scoping) leaks every doc in the stream through sync for `broadcast`/`custom` scopes. `$and` the resolved `queryFilter(user)` into both queries, or fail registration when a broadcast/custom-scoped model has a `queryFilter` sync would ignore. Also fix the adjacent doc drift: a consumer-supplied `snapshotFilter` is silently ignored for owner/tenant scopes (computed at ~382 and discarded) — compose it or reject it at registration.
  - Files: `api/src/sync/routes.ts`, `api/src/sync/registry.ts`, `api/src/sync/types.ts` docs, `api/src/sync/syncRoutes.test.ts`
  - Depends on: none
  - Acceptance: broadcast-scoped model with an owner queryFilter — snapshot only returns the caller's docs; parity test between REST list results and snapshot contents.

- [ ] **Task 9.20**: Server — rate limiting: per-user socket window, eviction, shared implementation
  - Description: The socket mutation budget lives in a per-connection closure — N sockets = N×budget per user — while HTTP is per-user; `httpMutationWindows` grows unboundedly (never evicted); both transports duplicate the size-cap→rate-limit→validate→apply orchestration with drift, and both burn budget on batches that then fail duplicate-id validation. Extract a shared `runSyncBatch` keyed by userId in one module-level window map with expiry eviction; validate before consuming budget; document per-process semantics for multi-instance deployments.
  - Files: `api/src/sync/routes.ts`, `api/src/sync/socketHandlers.ts`, new shared module + tests
  - Depends on: none
  - Acceptance: one user on two sockets shares one budget; expired windows evicted; invalid batch consumes no budget; HTTP/socket behavior identical under the same inputs.

- [ ] **Task 9.21**: Server — limit conflict `serverDoc` retention in the ledger; require full socket user for tenant scopes
  - Description: (a) Conflict nacks persist the full serialized server doc (PHI in health apps) in `syncmutations` for the 30-day TTL — far beyond any replay window. Strip `serverDoc` after a short secondary window, or store only `{resultSeq, resultId}` and re-serialize the live doc on duplicate delivery. (b) D2 half-done: `getSocketUser` still silently falls back to the synthetic `{_id, admin, id}` user when `RealtimeAppOptions.userModel` is unset — JWT-claim `admin` trusted over the DB, tenant `getUserScopes` sees no `organizationIds`. Fail (or loudly warn) at startup when the sync registry contains tenant/custom scopes and no `userModel` is configured; close the handshake window where `sync:subscribe` can arrive before the fire-and-forget full-user load resolves.
  - Files: `api/src/sync/models.ts`, `api/src/sync/mutationHandler.ts`, `api/src/realtime/socketUser.ts`, `api/src/realtime/realtimeApp.ts`, tests
  - Depends on: none
  - Acceptance: ledger rows lose `serverDoc` after the window while duplicate delivery still returns a correct conflict; tenant-scoped registration without `userModel` fails startup (or warns loudly, decided with repo owner). Also reject tenant-scoped creates whose scope field is absent (`enforceWriteScope` currently passes `undefined` through, landing docs in an unreachable `tenant:undefined` stream).

### 9.D Example app + e2e

- [ ] **Task 9.22**: example-frontend — surface start failure; wire the full `SyncStatusBanner` prop set
  - Description: (a) `app/_layout.tsx`: `syncDb.start()` failure only `console.error`s; `syncDbReady` never becomes true, the new-todo form stays disabled forever with zero feedback. Show a retry affordance (toast/state) and re-invoke start. (b) `SyncTodosScreen` passes only 5 of 11 banner props — `paused`, `failedCount`, `draining`, `sentThisDrain`, `totalThisDrain`, `onAuthRequired` are never wired, so the B5 states (auth-pause indicator, drain progress, failed badge) are undemonstrable in the reference app. Wire them from `useSyncStatus` and hook `onAuthRequired` to the re-login flow.
  - Files: `example-frontend/app/_layout.tsx`, `example-frontend/components/SyncTodosScreen.tsx`
  - Depends on: none
  - Acceptance: killing the backend during startup produces a visible retry path; one e2e asserts `sync-paused-auth-indicator` appears under a forced 401 (the conflicts/chaos suites already have the plumbing).

- [ ] **Task 9.23**: UI — ConflictSheet dismissal + single instance; banner/Toast polish
  - Description: (a) `ConflictSheet.handleResolve` calls `onDismiss()` when `conflicts.length <= 1` BEFORE the async resolution settles — premature close on failure, races prop updates. Dismiss from an effect when `conflicts.length === 0`. (b) Two ConflictSheet instances can mount at once (root `SyncHealthToast` modal + `SyncTodosScreen`) duplicating every `conflict-*` testID — keep one instance (shared state/context). (c) `SyncStatusBanner`: pressable paused-auth indicator and failed badge lack `accessibilityRole="button"`/labels (conflict badge has them); `isSyncing` prop is accepted and never used — deprecate or remove. (d) `Toast` action button: raw `NativeText` with hardcoded font/padding, `aria-role` instead of `accessibilityRole`, fixed `toast-action-button` testID collides when two action toasts stack — theme it and suffix with toast id.
  - Files: `ui/src/ConflictSheet.tsx`, `ui/src/SyncStatusBanner.tsx`, `ui/src/Toast.tsx`, `example-frontend/app/_layout.tsx`, `example-frontend/components/SyncTodosScreen.tsx`, tests
  - Depends on: none
  - Acceptance: strict-mode e2e run shows no duplicate testIDs with the toast + todos screen both live; failed-resolve keeps the sheet open; a11y roles present.

- [ ] **Task 9.24**: e2e — resolve the serial-worker workaround left over from E1
  - Description: Plan E1 said to remove the serial-file workaround in `playwright.config.ts` once concurrent syncdb clients were stable; the config still chains all six syncdb projects with a comment blaming the client lifecycle race that E1 fixed. Either validate two syncdb specs sharing a worker (the E1 regression proof) and relax the chain, or update the comment to the real remaining reason (shared backend/user state).
  - Files: `example-frontend/playwright.config.ts`
  - Depends on: 9.1
  - Acceptance: config comment matches reality; if parallelized, the matrix stays green across 3 consecutive runs.

### 9.E Cleanup / readability

- [ ] **Task 9.25**: Client cleanup batch (replay hot path, mutate-delete, misc lifecycle leaks)
  - Description: (a) `computeBlockedEntityKeys` (~561–618): the loop calling `isDirectlyBlocked` per queued mutation re-scans the whole `_conflicts` table per mutation (O(queued × conflicts)) and can never add a key its seeding didn't already add — delete it (or hoist `listConflicts` once per pass). (b) `mutate()` delete path: `softDeleteEntity` followed by `upsertEntity({deleted: true})` is a redundant double-write, and deleting a locally nonexistent id fabricates a phantom tombstone row + a doomed queued mutation — drop the first call and early-return/throw for unknown ids. (c) `forceResync` returns `reason: "noStreams"` for supersession — add a distinct `"superseded"` reason. (d) `reconcile()` has no in-flight coalescing (startup/reconnect/timer/seq-jump can all run full stream discovery concurrently) — coalesce like `inFlightReplays`. (e) The debug `BroadcastChannel` bridge returned by `attachDebugChannel` is never closed — retain it and close in `stop()`.
  - Files: `syncdb/src/sync/replayCoordinator.ts`, `syncdb/src/client.ts`, `syncdb/src/debug/debugChannel.ts`, tests
  - Depends on: none
  - Acceptance: existing suite green; new tests for the phantom-delete guard and reconcile coalescing; no `BroadcastChannel` leak after `stop()` (assert via test hook).

- [ ] **Task 9.26**: Curate the `@terreno/syncdb` public API surface
  - Description: `index.ts` `export *`s the entire internal module graph — `fakeTransport` (a test double), raw storage row shapes/`RESERVED_TABLE_PREFIX`, cell-level cursor mutators (`setCursor`, `markStreamBootstrapped`), outbox internals, `idb` helpers, debug channel internals. Everything reachable is de-facto semver-protected API and lets host apps corrupt invariants. Move `fakeTransport` to a `@terreno/syncdb/testing` subpath export; reduce `index.ts` to named exports of the intended surface (`createSyncDb`, config/status/conflict types, auth adapter, key providers/codecs, persister factories, React entry). While there: confirm the F5 decision with the repo owner (docs-only deprecation of the RTK offline middleware vs restoring a slim `offline.spec.ts` — the branch chose docs-only; non-sync screens still use the middleware with zero e2e coverage).
  - Files: `syncdb/src/index.ts`, `syncdb/package.json` (exports map), `rtk/README.md` (if F5 decision changes), downstream imports in `example-frontend` + tests
  - Depends on: none
  - Acceptance: `bun run compile` green across the workspace; e2e/tests import test doubles from the testing subpath; README documents the public surface only.

- [ ] **Task 9.27**: Server cleanup batch (dedupe transports, entities input validation, bulkWrite guard)
  - Description: (a) Extract the duplicated size-cap→rate-limit→validate→apply batch orchestration shared by `routes.ts` (~609–662) and `socketHandlers.ts` (~305–377) — folds into Task 9.20's shared module. (b) `/sync/entities`: invalid ObjectId strings in `ids` throw CastError→500 (should be 400); `.slice(0, MAX_ENTITY_FETCH)` silently truncates so the client believes a repair fetch was complete — return 400 for oversized/invalid input; `parseNonNegativeInt` accepts `"12abc"`. (c) `Model.bulkWrite` bypasses every plugin guard (documented but unenforced) — patch the model's `bulkWrite` at registration to throw the same loud error as the query guards. (d) Extract `pageSeqStratum` from the ~160-line snapshot closure to mirror `pageLegacyStratum`.
  - Files: `api/src/sync/routes.ts`, `api/src/sync/socketHandlers.ts`, `api/src/sync/registry.ts`, tests
  - Depends on: 9.20
  - Acceptance: focused tests per item; snapshot handler under ~80 lines; `bulkWrite` on a synced model throws.

### 9.F Docs

- [ ] **Task 9.28**: `syncdb/README.md` — document the drifted public APIs and failure semantics
  - Description: The README has zero mentions of: `forceResync` (+ `ForceResyncResult` semantics), `useEntityIds` (the recommended fast-list pattern per its own doc comment), `goOffline`/`goOnline`, `signOut`/`wipeOnSignOut` (INV-2's only sanctioned explicit wipe), `startAuthRetryAttempts`/`startAuthRetryDelayMs`, and the `debug` config / `useSyncDebugLog` surface. Also state the terminal-failure semantics explicitly (what happens to locally diverged data after a validation nack — write whatever Task 9.11 lands).
  - Files: `syncdb/README.md`
  - Depends on: 9.11, 9.26
  - Acceptance: every exported public API appears in the README; failure-semantics section reviewed against the shipped behavior.

- [ ] **Task 9.29**: Docs housekeeping — `USE_SYNCDB` drift, plan index, stale comments
  - Description: (a) `docs/how-to/migrate-rtk-to-syncdb.md` and this task list's Task 7.2 describe a `USE_SYNCDB` OpenFeature gate that no longer exists (`rg USE_SYNCDB example-frontend` is empty; `SyncTodosScreen` renders unconditionally) — update both to state the example is syncdb-only and present the flag as an optional migration technique. (b) `docs/implementationPlans/PLAN_INDEX.md` omits all three syncdb plans (`syncdb-local-first.md`, `terreno-syncdb-2.md`, `syncdb-phase-c-design.md`) — add them with status. (c) `syncdb-loadlab.spec.ts` still says the todo list is "a plain `.map()`" needing virtualization; it is FlashList-virtualized — fix the comment. (d) `app/syncdb-debug.tsx` intentionally bypasses @terreno/ui/theme for perf — add a one-line comment saying so, to stop it being copied as a pattern.
  - Files: `docs/how-to/migrate-rtk-to-syncdb.md`, `docs/tasks/syncdb-local-first.md`, `docs/implementationPlans/PLAN_INDEX.md`, `example-frontend/e2e/syncdb-loadlab.spec.ts`, `example-frontend/app/syncdb-debug.tsx`
  - Depends on: none
  - Acceptance: docs match the shipped code; plan index lists all syncdb plans.
