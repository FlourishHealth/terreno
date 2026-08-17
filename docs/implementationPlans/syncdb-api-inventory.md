# @terreno/syncdb API inventory (temporary)

Working document for the RTK → syncdb migration. Lists every public export from the three package entry points, with source locations verified against `syncdb/src/`.

## M5 — Does `bun run sdk` still work?

**Yes.** The example app still generates RTK Query hooks from the backend OpenAPI spec:

- `example-frontend/package.json:73` — `"sdk": "bun scripts/generate-sdk.ts && bun biome check --write scripts/generate-sdk.ts"`
- `example-frontend/scripts/generate-sdk.ts:22` — runs `@rtk-query/codegen-openapi` against `openapi-config.ts`
- `example-frontend/openapi-config.ts:11` — output is `./store/openApiSdk.ts`

**What it generates now (post-migration):** typed RTK Query hooks for **non-synced** routes — Better Auth, `GET /auth/me`, admin, AI explorer, version config, feature-flag configuration, and any custom REST endpoints. Synced collections (e.g. todos) are **not** read or written through generated hooks; they use `@terreno/syncdb` hooks instead. `example-frontend/store/sdk.ts` still wraps `openApiSdk.ts` with tag enhancements and realtime wiring for endpoints that remain on RTK (todos realtime config is legacy/unused by the syncdb screen).

## M7 — Local-first only vs opt-in?

**Local-first only — there is no server-first mode and no opt-in flag.**

The on-device TinyBase store is always the UI source of truth; reads come from local state, writes apply optimistically, and the server reconciles asynchronously.

- `syncdb/src/index.ts:4-7` — package doc: "reads come from the local store, writes apply optimistically… the server is asynchronous reconciliation"
- `syncdb/README.md:3-4` — "TinyBase MergeableStore … is the UI's source of truth"
- `syncdb/src/client.ts:60-151` (`SyncDbConfig`) — no `mode`, `serverFirst`, or similar option

---

## `@terreno/syncdb` (`syncdb/src/index.ts`)

### Client factory and constants

| Symbol | Kind | Description | Source |
|--------|------|-------------|--------|
| `createSyncDb` | `function (config: SyncDbConfig): SyncDb` | Assemble the local-first client | `client.ts:281` |
| `DEFAULT_RECONCILE_INTERVAL_MS` | `const` (5 min) | Default periodic reconcile interval | `client.ts:38` |
| `DEFAULT_SEQ_JUMP_RECONCILE_MIN_INTERVAL_MS` | `const` (30s) | Seq-jump reconcile rate limit | `client.ts:41` |
| `DEFAULT_TOMBSTONE_RETENTION_MS` | `const` (90 days) | Client tombstone compaction window | `client.ts:44` |
| `DEFAULT_START_AUTH_RETRY_ATTEMPTS` | `const` (3) | `start()` auth-resolution retries | `client.ts:55` |
| `DEFAULT_START_AUTH_RETRY_DELAY_MS` | `const` (250) | Delay between `start()` auth retries | `client.ts:56` |

### `SyncDbConfig` fields

| Field | Type | Default | Description | Source |
|-------|------|---------|-------------|--------|
| `name` | `string` | — (required) | Persisted database name | `client.ts:62` |
| `collections` | `string[]` | — (required) | Collections to sync | `client.ts:64` |
| `authProvider` | `AuthProvider` | — (required) | Token/user/auth-change surface | `client.ts:65` |
| `baseUrl` | `string?` | — | Server origin; required unless `transport` + `httpChannel` injected | `client.ts:67` |
| `transport` | `SyncTransport?` | socket transport from `baseUrl` | Transport override (tests) | `client.ts:69` |
| `httpChannel` | `HttpChannel?` | from `baseUrl` | HTTP channel override | `client.ts:71` |
| `persisterFactory` | `PersisterFactory?` | platform default | Persister override | `client.ts:73` |
| `keyProvider` | `KeyProvider?` | server-derived via `/sync/key` | Web encryption key provider | `client.ts:75` |
| `idbGetImpl` | test hook | — | IndexedDB read override (tests) | `client.ts:82` |
| `idbSetImpl` | test hook | — | IndexedDB write override (tests) | `client.ts:83` |
| `reconcileIntervalMs` | `number?` | `DEFAULT_RECONCILE_INTERVAL_MS` (5 min); `0` disables | Periodic reconcile timer | `client.ts:85` |
| `seqJumpReconcileMinIntervalMs` | `number?` | `DEFAULT_SEQ_JUMP_RECONCILE_MIN_INTERVAL_MS` | Per-stream seq-jump rate limit | `client.ts:87` |
| `now` | `() => number?` | `Date.now` | Injectable clock | `client.ts:89` |
| `random` | `() => number?` | `Math.random` | Injectable RNG for backoff jitter | `client.ts:91` |
| `debug` | `boolean \| SyncDebugLogOptions?` | `false` (off) | In-memory debug event log | `client.ts:98` |
| `onAuthRequired` | `() => void?` | — | Fires once per auth-pause episode | `client.ts:104` |
| `wipeOnSignOut` | `boolean?` | `false` | `signOut()` also wipes local data | `client.ts:111` |
| `batchSize` | `number?` | `50` (server caps at 100) | Max mutations per batched drain | `client.ts:113` |
| `haltQueueOnConflict` | `boolean?` | `false` | Conflict halts entire drain vs per-entity | `client.ts:119` |
| `onDecryptFailure` | `() => void?` | wipe + re-bootstrap (with `console.warn`) | Override decrypt-failure recovery | `client.ts:129` |
| `tombstoneRetentionMs` | `number?` | `DEFAULT_TOMBSTONE_RETENTION_MS`; `0` disables | Client tombstone compaction after reconcile | `client.ts:138` |
| `startAuthRetryAttempts` | `number?` | `DEFAULT_START_AUTH_RETRY_ATTEMPTS`; `1` disables | `start()` user-id resolution attempts | `client.ts:148` |
| `startAuthRetryDelayMs` | `number?` | `DEFAULT_START_AUTH_RETRY_DELAY_MS` | Delay between those attempts | `client.ts:150` |

### `SyncDb` methods and properties

| Member | Signature / type | Description | Source |
|--------|------------------|-------------|--------|
| `store` | `readonly SyncStore` | Local-first entity store | `client.ts:193` |
| `outbox` | `readonly Outbox` | Durable mutation outbox | `client.ts:195` |
| `debug` | `readonly SyncDebugLog \| undefined` | Debug log when `debug` enabled | `client.ts:270` |
| `start` | `() => Promise<void>` | Resolve user, persist, connect, bootstrap | `client.ts:202` |
| `stop` | `() => Promise<void>` | Disconnect, stop persistence, clear timers | `client.ts:204` |
| `goOffline` | `() => void` | Simulated outage (local writes continue) | `client.ts:212` |
| `goOnline` | `() => Promise<void>` | End simulated outage | `client.ts:218` |
| `mutate` | `(args: MutateArgs) => {mutationId, id}` | Optimistic write + enqueue + replay | `client.ts:224` |
| `reconcile` | `() => Promise<void>` | HTTP snapshot catch-up all streams | `client.ts:226` |
| `forceResync` | `() => Promise<ForceResyncResult>` | Purge streams and re-bootstrap from 0 | `client.ts:233` |
| `replayOutbox` | `() => Promise<void>` | Drain queued mutations now | `client.ts:235` |
| `resolveConflict` | `({mutationId, strategy}) => void` | Apply `useServer` or `keepMine` | `client.ts:237` |
| `retryFailed` | `({entityId}) => void` | Re-enable blocked entity queue | `client.ts:244` |
| `signOut` | `() => Promise<void>` | Explicit teardown; optional wipe | `client.ts:254` |
| `getSyncStatus` | `() => SyncStatus` | Aggregate sync state snapshot | `client.ts:256` |
| `onStatusChange` | `(callback) => () => void` | Subscribe to connectivity/syncing changes | `client.ts:264` |

### Supporting client types

| Symbol | Kind | Source |
|--------|------|--------|
| `MutateArgs` | `interface` `{collection, operation, id?, data?}` | `client.ts:182` |
| `ForceResyncSkipReason` | `type` union | `client.ts:162` |
| `ForceResyncResult` | `interface` | `client.ts:170` |

### Protocol, status, and conflict types (`types.ts`)

| Symbol | Kind | Source |
|--------|------|--------|
| `SyncMutationOperation` | `type` `"create" \| "update" \| "delete"` | `types.ts:9` |
| `SyncDelta` | `interface` | `types.ts:12` |
| `SyncMutateRequest` | `interface` | `types.ts:35` |
| `SyncAck` | `interface` | `types.ts:49` |
| `SyncNackCode` | `type` | `types.ts:63` |
| `SyncNack` | `interface` | `types.ts:66` |
| `SyncMutateBatchRequest` | `interface` | `types.ts:94` |
| `SyncMutateBatchResult` | `type` | `types.ts:107` |
| `SyncMutateBatchResponse` | `interface` | `types.ts:116` |
| `SyncSnapshotEntity` | `interface` | `types.ts:121` |
| `SyncEntitiesResponse` | `interface` | `types.ts:129` |
| `SyncSnapshotResponse` | `interface` | `types.ts:134` |
| `SyncStreamInfo` | `interface` | `types.ts:156` |
| `OutboxStatus` | `type` | `types.ts:164` |
| `OutboxMutation` | `interface` | `types.ts:167` |
| `SyncConflict` | `interface` | `types.ts:186` |
| `ConflictResolutionStrategy` | `type` `"useServer" \| "keepMine"` | `types.ts:206` |
| `SyncCollectionStatus` | `interface` | `types.ts:213` |
| `SyncStatus` | `interface` | `types.ts:220` |
| `AuthProvider` | `interface` | `types.ts:269` |

### Store / outbox / wipe

| Symbol | Kind | Source |
|--------|------|--------|
| `listConflicts` | `function` | `mutations/conflicts.ts:71` |
| `generateMutationId` | `function` | `mutations/outbox.ts` (re-export `index.ts:75`) |
| `Outbox` | `type` | `mutations/outbox.ts` |
| `SyncStore` | `type` | `storage/store.ts` |
| `OUTBOX_TABLE` | `const` | `storage/types.ts` |
| `SyncEntity` | `type` | `storage/types.ts` |
| `wipeLocalData` | `async function` | `storage/wipe.ts:19` |

### Auth adapter

| Symbol | Kind | Source |
|--------|------|--------|
| `betterAuthAdapter` | `function` | `auth/betterAuthAdapter.ts:39` |
| `DEFAULT_AUTH_POLL_INTERVAL_MS` | `const` (5000) | `auth/betterAuthAdapter.ts:5` |
| `BetterAuthAdapterOptions` | `interface` | `auth/betterAuthAdapter.ts:7` |
| `BetterAuthClientLike` | `type` | `auth/types.ts` |
| `BetterAuthGetSessionResult` | `type` | `auth/types.ts` |
| `BetterAuthSessionAtomLike` | `type` | `auth/types.ts` |
| `BetterAuthSessionDataLike` | `type` | `auth/types.ts` |
| `BetterAuthSessionLike` | `type` | `auth/types.ts` |
| `BetterAuthUserLike` | `type` | `auth/types.ts` |

### Encryption and key providers

| Symbol | Kind | Source |
|--------|------|--------|
| `AES_GCM_ENVELOPE_VERSION` | `const` | `crypto/aesGcmCodec.ts` |
| `createAesGcmCodec` | `function` | `crypto/aesGcmCodec.ts` |
| `PayloadIntegrityError` | `class` | `crypto/aesGcmCodec.ts` |
| `UnknownEnvelopeVersionError` | `class` | `crypto/aesGcmCodec.ts` |
| `identityCodec` | `const` | `crypto/identityCodec.ts` |
| `createKeyProviderCodec` | `function` | `crypto/keyProviders.ts` |
| `createLocalKeyProvider` | `function` | `crypto/keyProviders.ts` |
| `createServerKeyProvider` | `function` | `crypto/keyProviders.ts` |
| `DEFAULT_KEY_CACHE_DB_NAME` | `const` | `crypto/keyProviders.ts` |
| `KeyProvider` | `interface` | `crypto/types.ts` |
| `PayloadCodec` | `interface` | `crypto/types.ts` |

### Persisters

| Symbol | Kind | Source |
|--------|------|--------|
| `createDefaultPersisterFactory` | `function` | `persisters/defaultPersisterFactory.ts` |
| `createEncryptedIndexedDbPersister` | `function` | `persisters/encryptedIndexedDbPersister.ts` |
| `clearMemoryPersisterData` | `function` | `persisters/memoryPersister.ts` |
| `createMemoryPersister` | `function` | `persisters/memoryPersister.ts` |
| `memoryPersisterFactory` | `function` | `persisters/memoryPersister.ts` |
| `DefaultPersisterFactoryConfig` | `type` | `persisters/types.ts` |
| `PersisterFactory` | `type` | `persisters/types.ts` |

### Transports and HTTP channel

| Symbol | Kind | Source |
|--------|------|--------|
| `AuthRequiredError` | `class` | `sync/httpChannel.ts` |
| `createHttpChannel` | `function` | `sync/httpChannel.ts` |
| `FetchLike` | `type` | `sync/httpChannel.ts` |
| `FetchSnapshotPageArgs` | `type` | `sync/httpChannel.ts` |
| `HttpChannel` | `interface` | `sync/httpChannel.ts` |
| `HttpChannelConfig` | `interface` | `sync/httpChannel.ts` |
| `createSocketTransport` | `function` | `sync/socketTransport.ts` |
| `SocketTransportConfig` | `interface` | `sync/socketTransport.ts` |
| `DEFAULT_BATCH_SIZE` | `const` | `sync/transport.ts` |
| `DEFAULT_MUTATION_TIMEOUT_MS` | `const` | `sync/transport.ts` |
| `SendMutationBatchResult` | `type` | `sync/transport.ts` |
| `SendMutationResult` | `type` | `sync/transport.ts` |
| `SyncTransport` | `interface` | `sync/transport.ts` |
| `TransportStatus` | `interface` | `sync/transport.ts` |

### Debug log types

| Symbol | Kind | Source |
|--------|------|--------|
| `SyncDebugDirection` | `type` | `debug/debugLog.ts:43` |
| `SyncDebugEvent` | `interface` | `debug/debugLog.ts:46` |
| `SyncDebugEventType` | `type` | `debug/debugLog.ts:27` |
| `SyncDebugLog` | `interface` | `debug/debugLog.ts` |
| `SyncDebugLogOptions` | `interface` | `debug/debugLog.ts` |
| `SyncDebugRecordInput` | `interface` | `debug/debugLog.ts` |
| `SyncDebugSnapshot` | `interface` | `debug/debugLog.ts` |
| `SyncDebugStats` | `interface` | `debug/debugLog.ts` |

**Not exported (internal):** `resolveConflict` (mutation writer), `writeConflict`, cursor mutators, IndexedDB helpers, debug broadcast bridge — use `client.resolveConflict` / `useConflicts().resolve` instead.

---

## `@terreno/syncdb/react` (`syncdb/src/react/index.ts` → hooks + provider)

| Symbol | Kind | Description | Source |
|--------|------|-------------|--------|
| `SyncDbProvider` | `React.FC<SyncDbProviderProps>` | Provides client to descendants | `provider.tsx:13` |
| `SyncDbProviderProps` | `interface` `{client, children}` | Provider props | `provider.tsx:7` |
| `useSyncDbClient` | `() => SyncDb` | Access client from context | `provider.tsx:18` |
| `useEntity` | `<T>(collection, id) => UseEntityResult<T>` | Subscribe to one entity | `hooks.ts:117` |
| `UseEntityResult` | `interface` `{data, deleted, seq, isPending}` | `useEntity` return shape | `hooks.ts:105` |
| `useQuery` | `<T>(collection, options?) => T[]` | Subscribe to collection (decoded data) | `hooks.ts:170` |
| `UseQueryOptions` | `interface` `{filter?, sort?, includeDeleted?}` | Query options | `hooks.ts:149` |
| `useEntityIds` | `<T>(collection, options?) => string[]` | Stable id list for virtualization | `hooks.ts:221` |
| `useMutate` | `(collection) => UseMutateResult` | `{create, update, remove}` | `hooks.ts:266` |
| `UseMutateResult` | `interface` | Mutation helpers | `hooks.ts:253` |
| `useSyncStatus` | `() => SyncStatus` | Reactive aggregate status | `hooks.ts:296` |
| `useConflicts` | `() => UseConflictsResult` | `{conflicts, resolve}` | `hooks.ts:328` |
| `UseConflictsResult` | `interface` | Conflict hook return | `hooks.ts:320` |
| `useSyncDebugLog` | `() => UseSyncDebugLogResult` | Debug log subscription | `hooks.ts:379` |
| `UseSyncDebugLogResult` | `interface` `{enabled, events, stats, log, clear}` | Debug hook return | `hooks.ts:355` |

---

## `@terreno/syncdb/testing` (`syncdb/src/testing/index.ts`)

| Symbol | Kind | Description | Source |
|--------|------|-------------|--------|
| `createFakeTransport` | `() => FakeTransport` | In-memory transport double | `testing/fakeTransport.ts:74` |
| `FakeTransport` | `interface` extends `SyncTransport` | Test controls + recording | `testing/fakeTransport.ts:32` |
| `FakeMutationResponder` | `type` | Single-mutation responder | `testing/fakeTransport.ts:22` |
| `FakeBatchResponder` | `type` | Batch responder | `testing/fakeTransport.ts:27` |

---

## Reference migration (`example-frontend`)

Before paths are from `origin/master`; after paths are on the current branch.

### (a) Store setup

| | Path | What changed |
|---|------|--------------|
| **Before** | `example-frontend/store/index.ts` (master) | `generateAuthSlice(terrenoApi)`, `createOfflineMiddleware`, Redux persist, RTK Query reducer |
| **After** | `example-frontend/store/index.ts` | `generateBetterAuthSlice`, RTK only for non-synced API + app state |
| **After** | `example-frontend/store/syncdb.ts` | `createSyncDb({authProvider: betterAuthAdapter(...), collections: ["todos"], ...})` |

### (b) Provider wiring

| | Path | What changed |
|---|------|--------------|
| **Before** | `example-frontend/app/_layout.tsx` (master) | Redux `Provider` only; todos screen uses RTK hooks directly |
| **After** | `example-frontend/app/(tabs)/index.tsx` | `SyncDbProvider client={syncDb}` wraps `SyncTodosScreen` |
| **After** | `example-frontend/app/_layout.tsx` | `syncDb.start()` / `stop()` on login; `SyncDbProvider` + `SyncHealthToast` at root when `userId` set |

### (c) Reads

| | Path | What changed |
|---|------|--------------|
| **Before** | `example-frontend/app/(tabs)/index.tsx` (master) | `useGetTodosQuery({}, {skip: !userId})`, `isLoading`, `refetch` |
| **After** | `example-frontend/components/SyncTodosScreen.tsx` | `useEntityIds<SyncTodo>("todos", {filter, sort})` + per-row `useEntity("todos", id)` |

### (d) Writes

| | Path | What changed |
|---|------|--------------|
| **Before** | `example-frontend/app/(tabs)/index.tsx` (master) | `usePostTodosMutation`, `usePatchTodosByIdMutation`, `useDeleteTodosByIdMutation`, `.unwrap()`, per-item `isUpdating` spinners |
| **After** | `example-frontend/components/SyncTodosScreen.tsx` | `useMutate("todos")` → `create({data})`, `update({id, data})`, `remove({id})`; gated on `useSyncDbReady()` |

### (e) Conflict UI

| | Path | What changed |
|---|------|--------------|
| **Before** | master todos screen | `useServerStatus` undismissed conflicts (RTK offline slice) |
| **After** | `example-frontend/components/SyncConflictsController.tsx` | App-wide conflict sheet controller |
| **After** | `example-frontend/app/_layout.tsx` | `ConflictSheet` via `SyncHealthToast` `renderConflictsModal` |
| **After** | `example-frontend/components/SyncTodosScreen.tsx` | `SyncStatusBanner` `onOpenConflicts` → `openConflicts("todos")` |

### (f) Sync-status UI

| | Path | What changed |
|---|------|--------------|
| **Before** | master todos screen | `useServerStatus`, `OfflineBanner`, request `isLoading` / `isFetching` / `RefreshControl` |
| **After** | `example-frontend/components/SyncTodosScreen.tsx` | `useSyncStatus()` + `SyncStatusBanner` |
| **After** | `example-frontend/components/SyncHealthToast.tsx` | Persistent toasts for conflicts, failures, backlog |
| **After** | `example-frontend/components/syncHealthSignals.ts` | Toast signal computation |

### Not covered by the reference migration

- **Auth migration details** — Better Auth session atom bridge in `store/syncdb.ts`; login still uses `@terreno/rtk` Better Auth slice (documented in migration guide §7).
- **Feature flags** — OpenFeature bridge in `_layout.tsx` (`OpenFeatureBridge` + `useTerrenoFeatureFlags`); no per-screen flag gating todos (syncdb-only).
- **Other screens** — Profile, admin, AI explorer, consent flow still use generated RTK hooks (`store/sdk.ts`).
- **SDK realtime config for todos** — `TODO_REALTIME_ENDPOINTS` in `sdk.ts` remains but is unused by `SyncTodosScreen`.
- **Debug tooling** — `example-frontend/app/syncdb-debug.tsx` (`useSyncDebugLog`).
