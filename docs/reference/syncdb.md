# @terreno/syncdb

Local-first data layer for Terreno frontends. A TinyBase `MergeableStore` on device is the UI source of truth: reads come from the local store, writes apply optimistically into a durable outbox, and the server reconciles asynchronously over a socket delta protocol with HTTP snapshot catch-up. Supersedes `@terreno/rtk` for data-synchronization concerns.

## Table of Contents

- [Installation](#installation)
- [Architecture](#architecture)
- [Backend setup](#backend-setup)
- [createSyncDb configuration](#createsyncdb-configuration)
- [SyncDb client methods](#syncdb-client-methods)
- [React hooks](#react-hooks)
- [Codegen](#codegen)
- [Conflict API](#conflict-api)
- [Sync status API](#sync-status-api)
- [Stream scoping](#stream-scoping)
- [Sync protocol](#sync-protocol)
- [Encryption at rest](#encryption-at-rest)
- [Testing](#testing)
- [Environment variables](#environment-variables)
- [Conventions](#conventions)

## Key exports

- `createSyncDb`, `SyncDb`, `SyncDbConfig`, `MutateArgs`
- `betterAuthAdapter`, `AuthProvider`
- `listConflicts`, `wipeLocalData`, `generateMutationId`
- React (`@terreno/syncdb/react`): `SyncDbProvider`, `useEntity`, `useQuery`, `useEntityIds`, `useMutate`, `useSyncStatus`, `useConflicts`, `useSyncDebugLog`, `createCollectionHooks`
- CLI: `terreno-syncdb-codegen` (generates `SYNC_COLLECTIONS` + friendly hooks from OpenAPI)
- Testing (`@terreno/syncdb/testing`): `createFakeTransport`

## Installation

```bash
bun install @terreno/syncdb
```

**Peer dependencies:** `react` (optional — only for `@terreno/syncdb/react`), `luxon`, `tinybase`.

**Native persistence:** install `expo-sqlite` in the **app** (not only in a library):

```bash
bunx expo install expo-sqlite
```

Expo autolinking walks the app's own dependencies; a nested copy leaves the native module out of the build. Rebuild the native project after adding it.

**Why `@terreno/syncdb/react` is a separate subpath:** `react` is an optional peer dependency. Keeping React bindings off the main entry lets non-React consumers (Node tests, scripts) import `@terreno/syncdb` without loading React.

## Architecture

```
        FRONTEND (@terreno/syncdb)                 BACKEND (@terreno/api)
┌───────────────────────────────────┐      ┌────────────────────────────────────┐
│ React hooks (useQuery, useEntity, │      │ modelRouter(path, Model, {sync})   │
│ useMutate, useSyncStatus, ...)    │      │  └─ sync registry + validation     │
│        │            ▲             │      │                                    │
│        ▼            │             │      │ syncPlugin (schema)                │
│ TinyBase MergeableStore           │      │  └─ stamps _syncSeq per write      │
│  {collection} tables + _outbox    │      │                                    │
│  + _cursors + _conflicts          │      │ SyncApp (HTTP)     RealtimeApp     │
│        │            ▲             │      │  /sync/snapshot     (Socket.io +   │
│        ▼            │             │      │  /sync/mutate       change streams)│
│ Persister (AES-GCM IndexedDB on   │      │  /sync/key              │          │
│ web, expo-sqlite on native)       │      └─────────┬───────────────┼──────────┘
└──────┬─────────────────▲──────────┘                │               │
       │                 │                           │               │
       │   sync:mutate ─────────────────────────────►│               │
       │   sync:ack / sync:nack ◄────────────────────┘               │
       │   sync:delta ◄──────────────────────────────────────────────┘
       │   GET /sync/snapshot (bootstrap + catch-up, HTTP)
       └── POST /sync/mutate (fallback while the socket is down)
```

Every mutation executes the same `@terreno/api` modelRouter write path as REST — identical permissions, hooks, and validation.

## Backend setup

Register sync on the backend before the frontend client can sync a collection.

### Required schema plugins

```typescript
import {isDeletedPlugin, syncPlugin} from "@terreno/api";

todoSchema.plugin(isDeletedPlugin); // soft delete — required for tombstone catch-up
todoSchema.plugin(syncPlugin);      // stamps per-stream _syncSeq on every write
```

Apply plugins **before** the model compiles. Registration validates their presence.

### modelRouter sync config

Use the three-argument `modelRouter` form:

```typescript
import {modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";

const todoRouter = modelRouter("/todos", Todo, {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsOwner],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsOwner],
    update: [Permissions.IsOwner],
  },
  preCreate: (body, req) => ({...body, ownerId: (req.user as unknown as UserDocument)?._id}),
  queryFilter: OwnerQueryFilter,
  sync: {
    scope: {type: "owner"}, // stream = todos|owner:{ownerId}
  },
});
```

### SyncApp and RealtimeApp

```typescript
import {RealtimeApp, SyncApp, TerrenoApp} from "@terreno/api";

new TerrenoApp({userModel: User})
  .register(todoRouter)
  .register(new SyncApp())      // GET /sync/snapshot, POST /sync/mutate, GET /sync/key, ...
  .register(new RealtimeApp())  // Socket.io; sync:subscribe, sync:delta, sync:mutate
  .start();
```

- **`SyncApp`** — HTTP sync routes (`/sync/snapshot`, `/sync/mutate`, `/sync/mutate/batch`, `/sync/key`, `/sync/streams`, `/sync/entities`).
- **`RealtimeApp`** — Socket.io server with change-stream-driven `sync:delta` emission. Requires a **MongoDB replica set** (change streams).
- **`ensureSyncIndexes`** — `TerrenoApp.start()` awaits index builds for snapshot queries and sync bookkeeping (`SyncMutation.mutationId` unique, `SyncCounter.stream` unique, etc.). Registration queues this work without contacting MongoDB, so models can load before the database connects. Hosts that build Express without `TerrenoApp.start()` should await `ensureSyncIndexes()` after connecting.

Socket auth requires at least one configured authentication method. It enables legacy JWT
validation when `tokenSecret` or `TOKEN_SECRET` is available. Better Auth can be used without
a JWT secret:

```typescript
new RealtimeApp({betterAuth: {auth, userModel: User}})
```

When both methods are configured, JWT validation runs first and Better Auth session validation
is the fallback.

## createSyncDb configuration

```typescript
import {betterAuthAdapter, createSyncDb} from "@terreno/syncdb";

export const syncDb = createSyncDb({
  name: "myapp",
  collections: ["todos"],
  authProvider: betterAuthAdapter(authClient),
  baseUrl: "http://localhost:4000",
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | — (required) | Persisted database name |
| `collections` | `string[]` | — (required) | Collection names to sync (local tables + subscriptions) |
| `authProvider` | `AuthProvider` | — (required) | `{getToken, getUserId, onAuthChange, refresh?}` |
| `baseUrl` | `string` | — | Server origin; required unless both `transport` and `httpChannel` are injected |
| `transport` | `SyncTransport` | socket transport from `baseUrl` | Override for tests or custom wiring |
| `httpChannel` | `HttpChannel` | built from `baseUrl` | HTTP fallback channel override |
| `persisterFactory` | `PersisterFactory` | platform default (IndexedDB web, expo-sqlite native) | Storage backend override |
| `keyProvider` | `KeyProvider` | server-derived via `GET /sync/key` | Web encryption key provider |
| `idbGetImpl` / `idbSetImpl` | test hooks | — | Simulate IndexedDB failures (tests only) |
| `reconcileIntervalMs` | `number` | `300000` (5 min); `0` disables | Periodic reconcile + outbox replay timer |
| `seqJumpReconcileMinIntervalMs` | `number` | `30000` (30s) | Per-stream rate limit for seq-jump-triggered reconciles |
| `now` | `() => number` | `Date.now` | Injectable clock (tests) |
| `random` | `() => number` | `Math.random` | Injectable RNG for backoff jitter (tests) |
| `debug` | `boolean \| SyncDebugLogOptions` | `false` | In-memory debug event log |
| `onAuthRequired` | `() => void` | — | Fires once per auth-pause episode (prompt re-login) |
| `wipeOnSignOut` | `boolean` | `false` | `signOut()` also wipes local data |
| `batchSize` | `number` | `50` (server caps at 100) | Max mutations per batched drain send |
| `haltQueueOnConflict` | `boolean` | `false` | `true` = conflict halts entire drain; `false` = per-entity blocking |
| `onDecryptFailure` | `() => void` | wipe + re-bootstrap (with `console.warn`) | Override web decrypt-failure recovery |
| `tombstoneRetentionMs` | `number` | `7776000000` (90 days); `0` disables | Client tombstone compaction after successful reconcile |
| `startAuthRetryAttempts` | `number` | `3`; `1` disables | `start()` attempts to resolve `getUserId()` |
| `startAuthRetryDelayMs` | `number` | `250` | Delay between those attempts |

`start()` needs an authenticated user. It retries `getUserId()` briefly (transient session races after login) before rejecting.

## SyncDb client methods

| Method | Description |
|--------|-------------|
| `start()` | Resolve user, run wipe-on-user-change check, start persistence, connect transport, subscribe collections, start reconcile timer. Resolves even when offline. Idempotent while already started. |
| `stop()` | Disconnect, stop persistence, clear timers and listeners. |
| `goOffline()` | Simulated outage: disconnect transport, pause replay/reconcile/timer; local mutations keep queueing. |
| `goOnline()` | End simulated outage; reconnect triggers reconcile + outbox replay. |
| `mutate({collection, operation, id?, data?})` | Optimistic local write + durable outbox enqueue + fire-and-forget replay. Returns `{mutationId, id}`. |
| `reconcile()` | HTTP snapshot catch-up for every known stream; runs tombstone compaction on success. Also runs automatically on (re)connect, on a rate-limited seq-jump hint, and on the periodic timer; each `sync:subscribed` confirmation additionally pages just the streams it names. |
| `forceResync()` | Purge every known stream locally and re-bootstrap from cursor 0 (outbox/conflicts untouched). Returns `{ok, reason?, streams, purged, repaired}`. |
| `replayOutbox()` | Drain queued mutations for the current user now. |
| `resolveConflict({mutationId, strategy})` | Apply `"useServer"` or `"keepMine"` to a recorded conflict. |
| `retryFailed({entityId})` | Re-enable an entity's queued successors after a terminal validation failure. |
| `signOut()` | Explicit teardown like `stop()`; wipes local data only when `wipeOnSignOut: true`. |
| `getSyncStatus()` | Snapshot of aggregate sync state (see [Sync status API](#sync-status-api)). |
| `onStatusChange(callback)` | Subscribe to connectivity/syncing changes; returns unsubscribe. |
| `store` | Read surface over the local MergeableStore (`SyncStore`). |
| `outbox` | Durable mutation outbox (`Outbox`). |
| `debug` | `SyncDebugLog` when `debug` is enabled; otherwise `undefined`. |

## React hooks

Import from `@terreno/syncdb/react`:

```typescript
import {
  createCollectionHooks,
  SyncDbProvider,
  useConflicts,
  useEntity,
  useEntityIds,
  useMutate,
  useQuery,
  useSyncDbClient,
  useSyncDebugLog,
  useSyncStatus,
} from "@terreno/syncdb/react";
```

Wrap the app (or a subtree) in `SyncDbProvider`:

```tsx
<SyncDbProvider client={syncDb}>
  <TodoList />
</SyncDbProvider>
```

### `useEntity(collection, id)`

```typescript
const {data, deleted, seq, isPending} = useEntity<Todo>("todos", id);
```

Subscribe to a single entity. Re-renders when that row changes. `isPending` is true while an outbox mutation protects optimistic state.

### `useQuery(collection, options?)`

```typescript
const todos = useQuery<Todo>("todos", {
  filter: (t) => !t.completed,
  sort: (a, b) => b.created.localeCompare(a.created),
  includeDeleted: false,
});
```

Returns decoded entity data arrays. Tombstones excluded unless `includeDeleted: true`. Filter and sort run in JS — memoize callbacks when collections are large.

### `useEntityIds(collection, options?)`

```typescript
const ids = useEntityIds<Todo>("todos", {filter: (t) => !t.completed, sort: byCreatedDesc});
return ids.map((id) => <TodoRow key={id} id={id} />);
```

Same options as `useQuery`, but returns only ordered ids with **referential stability** — the array identity changes only when membership or order changes, not on field updates. Pair with per-row `useEntity` for large lists.

### `useMutate(collection)`

```typescript
const {create, update, remove} = useMutate("todos");

const {id, mutationId} = create({data: {title: "Milk", completed: false}});
update({id, data: {completed: true}});
remove({id});
```

Each call applies locally, enqueues in the outbox, and kicks off replay.

### `useSyncStatus()`

```typescript
const status = useSyncStatus();
// status.isOnline, status.isSyncing, status.queuedCount, status.conflictCount, ...
```

Reactive aggregate status; re-renders on outbox, conflict, cursor, connectivity, and drain-progress changes.

### `useConflicts()`

```typescript
const {conflicts, resolve} = useConflicts();
resolve({mutationId, strategy: "useServer"});
resolve({mutationId, strategy: "keepMine"});
```

### `useSyncDebugLog()`

```typescript
const {enabled, events, stats, log, clear} = useSyncDebugLog();
```

Available when the client was created with `debug: true`. `log?.snapshot()` returns a JSON-serializable object suitable for debug UIs or tooling.

### `useSyncDbClient()`

Returns the `SyncDb` instance from context (escape hatch for imperative calls like `forceResync()`).

### `createCollectionHooks`

Factory used by `terreno-syncdb-codegen` and by hand-written custom collections. Returns five operation hooks (`useListQuery`, `useReadQuery`, `useCreateMutation`, `useUpdateMutation`, `useDeleteMutation`). Generated SDKs rename them to friendly names (`useTodos`, `useTodo`, `useCreateTodo`, …). Mutation hooks return `[trigger]`; triggers apply locally and return `{mutationId, id}` synchronously. Optional `retries` maps to `maxAttempts` (`false` → 1, a number → that many, omitted → engine default).

```typescript
export const {useListQuery: useNotes, useCreateMutation: useCreateNote} =
  createCollectionHooks<Note, CreateNoteBody, UpdateNoteBody>({
    collection: "notes",
  });
```

## Codegen

`terreno-syncdb-codegen` is a bin of `@terreno/syncdb`. It reads OpenAPI, discovers list operations with `x-terreno-sync`, and writes typed hooks plus `SYNC_COLLECTIONS`.

```bash
terreno-syncdb-codegen \
  --schema http://localhost:4000/openapi.json \
  --out ./store/syncDbSdk.ts \
  --config ./syncdb-codegen.json
```

Do not edit the generated file. `--collections` filters when extensions exist. When they do not, it reads list/create/patch schemas from `GET /{name}` (or `/{name}/`). A missing path, a list response without `data.items`, a spec with no extensions and no `--collections` all exit non-zero.

## Conflict API

A **conflict** occurs when the client's `baseVersion` (last seen `_syncSeq`) does not match the server's current seq. The server responds with a `conflict` nack (HTTP **409** on `POST /sync/mutate`, or `sync:nack` with `code: "conflict"` on the socket) carrying the canonical server document.

The client records conflicts in the local `_conflicts` table. Read them with:

```typescript
import {listConflicts} from "@terreno/syncdb";

const conflicts = listConflicts({store: client.store});
```

In React, prefer `useConflicts()`.

### Resolution strategies

| Strategy | Behavior |
|----------|----------|
| `"useServer"` | Overwrite local entity with canonical server data/seq; clear pending state; discard conflicted outbox row. Writes a **tombstone** when the server side is deleted. |
| `"keepMine"` | Re-enqueue the mutation under a **fresh** `mutationId` with `baseVersion` set to the server's seq; local optimistic data is kept. |

Resolve via `client.resolveConflict({mutationId, strategy})` or `useConflicts().resolve(...)`.

### Conflict handling modes

- **Default (`haltQueueOnConflict: false`)** — per-entity blocking. Other entities keep draining.
- **`haltQueueOnConflict: true`** — any conflict halts the entire drain until resolved.

`getSyncStatus().blockedEntities` counts entities blocked by conflicts or terminal validation failures.

## Sync status API

`getSyncStatus()` / `useSyncStatus()` return `SyncStatus`:

| Field | Type | Description |
|-------|------|-------------|
| `isOnline` | `boolean` | Transport connected |
| `isSyncing` | `boolean` | Reconcile or replay in flight |
| `queuedCount` | `number` | Outbox rows awaiting send |
| `conflictCount` | `number` | Unresolved conflicts |
| `failedCount` | `number` | Terminal `failed` outbox rows |
| `paused` | `"auth"?` | Replay paused for auth failure |
| `blockedEntities` | `number` | Entities blocked (conflict or validation) |
| `draining` | `boolean` | Outbox drain actively running |
| `sentThisDrain` | `number` | Mutations sent in current/most recent drain |
| `totalThisDrain` | `number` | Queue length when drain began |
| `streams` | `Record<string, number>` | Per-stream cursors (stream → highest applied seq) |
| `collections` | `Record<string, SyncCollectionStatus>` | Per-collection queued/conflict/failed counts |
| `persistence` | `"durable" \| "memory" \| "error"` | Local persistence health (web) |

`SyncCollectionStatus`: `{queuedCount, conflictCount, failedCount}`.

## Stream scoping

Streams are the unit of ordered delivery, keyed `{collection}|{scope}`:

```typescript
sync: {scope: {type: "owner"}}                        // todos|owner:{ownerId}
sync: {scope: {type: "owner", field: "userId"}}       // todos|owner:{userId}
sync: {scope: {type: "tenant", field: "organizationId"}} // todos|tenant:{orgId}
sync: {scope: {type: "broadcast"}}                    // todos|all
sync: {
  scope: (doc) => String(doc.workspaceId),
  snapshotFilter: (user) => ({workspaceId: {$in: [...]}}), // required for custom
}
```

- **Owner** streams use the authenticated socket's user id (client cannot pick another user's stream).
- **Tenant/custom** scopes resolve memberships via `SyncApp` `getUserScopes`.
- **`snapshotFilter`** restricts `GET /sync/snapshot` server-side. Auto-derived for owner/tenant; required for custom resolver scopes.

## Sync protocol

### HTTP routes (`SyncApp`, all authenticated)

| Endpoint | Purpose |
|----------|---------|
| `GET /sync/snapshot?collection=&stream=&cursor=&limit=` | Bootstrap + catch-up per stream |
| `GET /sync/streams` | Current stream membership for the user |
| `GET /sync/entities` | Point lookup for entity repair |
| `POST /sync/mutate` | Single mutation (HTTP fallback) |
| `POST /sync/mutate/batch` | Batched mutations (max 100, strict order, stop at first non-ack) |
| `GET /sync/key` | Per-user encryption key material (web) |

Conflict responses on mutate: **409** with `{nack}` body (`code: "conflict"`).

### Socket events (`RealtimeApp`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `sync:subscribe` / `sync:unsubscribe` | client → server | `{collections: string[]}` |
| `sync:subscribed` | server → client | `{collection, streams}` — sent after the stream rooms are joined; the client pages each confirmed stream from its cursor so a write landing between the startup snapshot and the join is not missed |
| `sync:error` | server → client | `{collection, message}` |
| `sync:delta` | server → client | `{collection, id, method, data?, seq, stream, deleted?, frontierSeq?}` |
| `sync:mutate` | client → server | `{mutationId, collection, operation, id?, data?, baseVersion?}` |
| `sync:ack` | server → client | `{mutationId, id, seq}` |
| `sync:nack` | server → client | `{mutationId, code, serverDoc?, serverSeq?, serverDeleted?, message?, retryAfterMs?}` |
| `sync:mutateBatch` | client → server | `{mutations: SyncMutateRequest[], batchId?}` |
| `sync:auth-expired` | server → client | `{reason: "expired" \| "disabled"}` — session re-validation sweep; client enters auth-pause |

Limits: 50 collection subscriptions per socket; 100 mutations/second per socket (each batch mutation counts); batches capped at 100.

## Encryption at rest

**Web:** AES-256-GCM encrypted IndexedDB by default via pluggable `KeyProvider`:

- **`createServerKeyProvider`** (default) — derives key from `GET /sync/key` material (HKDF); server can rotate/revoke.
- **`createLocalKeyProvider`** — device-local random key; no server copy.

```typescript
import {createLocalKeyProvider, createSyncDb} from "@terreno/syncdb";

const syncDb = createSyncDb({
  name: "myapp",
  collections,
  authProvider,
  baseUrl,
  keyProvider: createLocalKeyProvider(),
});
```

Undecryptable persisted data triggers wipe + re-bootstrap by default (`onDecryptFailure` to override). Storage read errors surface `persistence: "error"` without overwriting the blob.

**Native:** plaintext SQLite in the OS sandbox (by design).

## Testing

```typescript
import {createFakeTransport} from "@terreno/syncdb/testing";
import {createSyncDb} from "@terreno/syncdb";

const transport = createFakeTransport();
const client = createSyncDb({
  name: "test",
  collections: ["todos"],
  authProvider: fakeAuth,
  transport,
  httpChannel: fakeHttp,
});

transport.respondWithAck();
transport.deliverDelta({...});
```

`createFakeTransport` records sent mutations, simulates connectivity, delivers deltas, and queues ack/nack responders.

## Environment variables

Syncdb reads no environment variables directly. Host apps typically set:

| Variable | Used by | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | `@terreno/rtk` `baseUrl` | Backend origin passed to `createSyncDb({baseUrl})` |

Backend sync requires a MongoDB replica set (`MONGO_URI` with `replicaSet=`) for `RealtimeApp` change streams.

## Conventions

- **Local-first only** — there is no server-first mode. The local store is always the read source.
- **Synced models need `String` `_id`** — offline creates mint client ids (UUIDs); default ObjectId `_id` cast-fails.
- **Soft delete only** on synced models — `isDeletedPlugin` required; hard deletes break tombstone catch-up.
- **No `bulkWrite` / `updateMany` / `deleteMany`** on synced models — use per-document loops.
- **Do not write reserved tables** (`_outbox`, `_cursors`, `_conflicts`) directly — use `client.mutate`, hooks, and `resolveConflict`.
- **User switch wipes local data** — confirmed different-user login clears the previous user's store; bare logout/401 does not (INV-2).
- **Keep `@terreno/rtk` for non-synced routes** — generated OpenAPI hooks remain the right tool for custom REST endpoints, admin, and auth configuration. See [How to migrate from RTK to syncdb](../how-to/migrate-rtk-to-syncdb.md).
