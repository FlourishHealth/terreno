# @terreno/syncdb

Local-first data layer for Terreno apps. A TinyBase `MergeableStore` (encrypted IndexedDB on web, expo-sqlite on native) is the UI's source of truth: reads come from the local store, writes apply optimistically and enqueue in a durable outbox, and the server reconciles asynchronously over a socket delta protocol with HTTP snapshot catch-up. Every mutation executes the existing `@terreno/api` modelRouter write path — identical permissions, hooks, and validation as REST. Supersedes `@terreno/rtk` for data-synchronization concerns (see [the migration guide](../docs/how-to/migrate-rtk-to-syncdb.md)).

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

## Installation

```bash
bun install @terreno/syncdb
# native persistence (optional peer):
bun install expo-sqlite
```

React bindings live on the `@terreno/syncdb/react` subpath so the main entry stays importable without react.

## Quick start

### Backend

Apply both required plugins to the schema, add a `sync` config to the modelRouter (three-argument form required), and register `SyncApp` (HTTP routes) plus `RealtimeApp` (socket + `sync:delta` emission):

```typescript
import {
  isDeletedPlugin,
  modelRouter,
  OwnerQueryFilter,
  Permissions,
  RealtimeApp,
  SyncApp,
  syncPlugin,
  TerrenoApp,
} from "@terreno/api";

todoSchema.plugin(isDeletedPlugin); // soft delete — required (deletes must remain queryable tombstones)
todoSchema.plugin(syncPlugin); // stamps a per-stream _syncSeq on every write

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

new TerrenoApp({userModel: User})
  .register(todoRouter)
  .register(new SyncApp()) // GET /sync/snapshot, POST /sync/mutate, GET /sync/key
  .register(new RealtimeApp()) // Socket.io server; installs sync:subscribe/sync:mutate handlers
  .start();
```

Registration is validated at startup: a model with a `sync` config but no `isDeletedPlugin`, no `syncPlugin`, a missing scope field, or a custom scope without a `snapshotFilter` throws with an actionable message. The registry also creates the `{scopeField, _syncSeq}` compound index that snapshot/catch-up queries use.

`RealtimeApp` requires a MongoDB replica set (change streams). Socket auth accepts legacy JWTs by default; add Better Auth sessions with `new RealtimeApp({betterAuth: {auth, userModel: User}})`.

### Frontend

```typescript
import {betterAuthAdapter, createSyncDb} from "@terreno/syncdb";
import {SyncDbProvider, useMutate, useQuery, useSyncStatus} from "@terreno/syncdb/react";
import {createBetterAuthClient} from "@terreno/rtk";

const authClient = createBetterAuthClient({baseURL: "http://localhost:4000"});

export const syncDb = createSyncDb({
  authProvider: betterAuthAdapter(authClient),
  baseUrl: "http://localhost:4000",
  collections: ["todos"],
  name: "myapp",
});

// After login. Resolves even when offline — the app works local-first and
// syncs when connectivity returns.
await syncDb.start();
```

```tsx
const App = () => (
  <SyncDbProvider client={syncDb}>
    <TodoList />
  </SyncDbProvider>
);

const TodoList: React.FC = () => {
  const todos = useQuery<Todo>("todos", {filter: (t) => !t.completed});
  const {create, update, remove} = useMutate("todos");
  const status = useSyncStatus(); // {isOnline, isSyncing, queuedCount, conflictCount, streams}

  // create({data: {title: "Milk"}}) applies locally, enqueues in the durable
  // outbox, and replays to the server (socket first, HTTP fallback).
  // update({id, data: {completed: true}}) merges fields; remove({id}) soft-deletes.
  ...
};
```

### Client API surface

```typescript
const client = createSyncDb({
  name,                           // persisted database name
  collections,                    // string[] — synced collections
  authProvider,                   // {getToken, getUserId, onAuthChange}
  baseUrl?,                       // server origin (required unless transport + httpChannel injected)
  keyProvider?,                   // web encryption key provider (default: server-derived via GET /sync/key)
  persisterFactory?,              // platform persister override
  transport?, httpChannel?,       // test/DI overrides
  reconcileIntervalMs?,           // periodic reconcile (default 5 min; 0 disables)
  seqJumpReconcileMinIntervalMs?, // seq-jump reconcile rate limit (default 30s)
  batchSize?,                     // max mutations per batched drain send (default 50; server caps at 100)
  haltQueueOnConflict?,           // conflict policy — see "Conflict handling modes" below (default false)
  onDecryptFailure?,              // override the default wipe+re-bootstrap on undecryptable data (web)
  tombstoneRetentionMs?,          // client-side tombstone compaction window (default 90 days; 0 disables)
});

client.start() / client.stop();  // start() is idempotent while already started (a second call is a no-op)
client.mutate({collection, operation, id?, data?}); // → {mutationId, id}
client.reconcile();       // HTTP snapshot catch-up for every collection; also runs tombstone compaction on success
client.replayOutbox();    // drain queued mutations now
client.resolveConflict({mutationId, strategy: "useServer" | "keepMine"});
client.retryFailed({entityId});  // re-enable an entity's queued successors after a terminal validation failure
client.getSyncStatus();   // {isOnline, isSyncing, queuedCount, conflictCount, failedCount, blockedEntities,
                           //  paused?, draining, sentThisDrain, totalThisDrain, streams, persistence}
                           //  persistence: "durable" | "memory" | "error" — see "Encryption at rest" below
client.onStatusChange(cb);
client.store / client.outbox; // low-level access
```

React hooks (`@terreno/syncdb/react`): `SyncDbProvider`, `useSyncDbClient`, `useEntity(collection, id)`, `useQuery(collection, {filter?, sort?, includeDeleted?})`, `useMutate(collection)`, `useSyncStatus()`, `useConflicts()`.

## Batched replay & stop-the-line policy

Queued mutations drain in contiguous chunks (≤ `batchSize`, default 50) over `POST /sync/mutate/batch` (or `sync:mutateBatch` when the socket is connected) rather than one request per mutation — an offline session of hundreds of edits costs `~N/batchSize` round-trips instead of `N`. Ordering is never sacrificed for this: a chunk carries at most one mutation per entity (a second mutation for an entity already in the chunk cuts it short — the next chunk picks it up once the first has acked and the send-time `baseVersion` refresh has run), and the server applies a batch strictly in array order, stopping at the first non-ack (results shorter than the request means the client re-sends the untouched tail — safe by idempotency). If the server or transport doesn't support batching (HTTP 404, or a socket that never acknowledges `sync:mutateBatch`), the client falls back to single-mutation sends in the same global order and re-probes batch support on the next reconnect.

Not every failure is handled the same way — the table below is the client's stop-the-line policy:

| Outcome | Policy |
|---|---|
| `error` (transient), transport failure/timeout, `unauthorized` | **Halts the whole drain.** Jittered backoff (or auth-pause) applies; nothing after it sends until the retry/re-auth. |
| `rate_limited` | Treated **exactly like a transport failure**: back to `queued` with the same unlimited jittered backoff (the server's `retryAfterMs`, when present, is a floor on that backoff), never counted against the error-nack budget (`errorNackCount`). A rate limit is the server asking the client to slow down — it must never look like a durable-data error or push the client toward terminal `failed`. Halts the whole drain, same as a transport failure. |
| `conflict` | **Blocks only that entity** by default: the entity's later queued mutations are skipped (stay `queued`, budgets untouched) until the user resolves the conflict via `resolveConflict`; other entities keep draining. Set `haltQueueOnConflict: true` to escalate a conflict into a whole-drain halt instead (for apps with cross-entity ordering dependencies where an unresolved conflict must not let anything past it). |
| `validation` | Terminal for that mutation (existing `markFailed` behavior) and its entity's queued successors are skipped-and-surfaced the same way a conflict blocks — a successor built on a rejected write is likely also invalid. Re-enable them with `client.retryFailed({entityId})` once the underlying issue is fixed. A block with no queued successor left (e.g. its failed row aged out via `prune()`) is garbage-collected automatically — a brand-new mutation for that entity is never quarantined forever. |

### Conflict handling modes

- **Default (`haltQueueOnConflict: false`)** — per-entity blocking. A conflict on one entity never stalls unrelated entities; only that entity's own queue is paused pending `resolveConflict`. Best for apps where entities are largely independent (e.g. a todo list).
- **`haltQueueOnConflict: true`** — whole-drain halt. Any conflict stops the ENTIRE drain until it's resolved, even for unrelated entities. Choose this when later-queued mutations (in any entity/collection, or across collections via foreign-key-style references) may depend on assumptions invalidated by the conflicting write, and blindly continuing risks compounding the problem. This is the stronger guarantee when your data model has cross-collection references (e.g. a todo referencing a project id) and you want ordering correctness to trump availability of unrelated entities during a conflict.

`client.getSyncStatus().blockedEntities` reports how many distinct entities are currently blocked (conflict or skipped validation failure) so the UI can surface it (see `SyncStatusBanner`'s failed/conflict badges).

### Cross-collection reference blocking (per-entity mode)

Under the default per-entity blocking mode, a conflict or validation failure on one entity does not, by itself, stop mutations for *unrelated* entities. But apps commonly have cross-collection references — e.g. creating a project P and then a todo T with `{projectId: P}` — where T is meaningless if P never lands on the server. To keep that case safe without requiring `haltQueueOnConflict: true` for the whole app, the coordinator also blocks a queued mutation whose parsed `args` contain, anywhere (recursively through nested objects/arrays), a string that exactly equals the entity id of a currently-blocked entity belonging to the same user. So if P conflicts, T (referencing P's id) stays `queued` and is never sent until P's conflict is resolved — even though T's own entity has no conflict of its own. This blocking is recomputed fresh on every drain pass from current block state (never a persisted dependency graph), so resolving P via `resolveConflict`/`retryFailed` naturally unblocks T on the next drain. It is intentionally conservative — a false-positive block (a string that happens to match a blocked id but isn't really a reference) is safe; a false negative is not.

If your data model has enough cross-collection references that you want ordering guaranteed for ALL entities (not just ones whose args happen to reference a blocked id), use `haltQueueOnConflict: true` instead — see "Conflict handling modes" above.

## Stream scoping

Streams are the unit of ordered delivery and cursor resumption, keyed `{collection}|{scope}` — multi-tenant by default:

```typescript
sync: {scope: {type: "owner"}}                       // todos|owner:{ownerId}   (field defaults to "ownerId")
sync: {scope: {type: "owner", field: "userId"}}      // todos|owner:{userId}
sync: {scope: {type: "tenant", field: "organizationId"}} // todos|tenant:{orgId}
sync: {scope: {type: "broadcast"}}                   // todos|all
sync: {
  scope: (doc) => String(doc.workspaceId),           // todos|custom:{value}
  snapshotFilter: (user) => ({workspaceId: {$in: [...]}}), // REQUIRED for custom scopes
}
```

- **Owner** streams are always keyed by the authenticated socket's own user id — a client-supplied id never selects the stream.
- **Tenant** (and custom) subscriptions resolve the user's memberships via `SyncAppOptions.getUserScopes`:

```typescript
new SyncApp({
  getUserScopes: async (user, entry) => {
    const memberships = await Membership.find({userId: user.id});
    return memberships.map((m) => String(m.organizationId));
  },
});
```

- **`snapshotFilter`** is the server-side query restricting `GET /sync/snapshot` to the caller's documents. It is derived automatically for owner (`{field: user.id}`) and tenant (`{field: {$in: getUserScopes(...)}}`) scopes; custom resolver scopes must supply one (a stream function cannot be inverted into a Mongo query) — validated at registration.
- **`responseHandler`** on the sync config sanitizes payloads for snapshots and deltas, falling back to the modelRouter `responseHandler`, then the document's `toJSON`.

Scope changes (a doc moves owner/tenant) are handled at write time: `syncPlugin` stamps `_syncPrevStream`, and the change-stream watcher emits a tombstone delta to the previous stream plus a create delta to the new one.

## Write-path restrictions

`syncPlugin` stamps `_syncSeq` on: `save`, `insertMany`, `updateOne`, `findOneAndUpdate`, `replaceOne`, `findOneAndReplace`. These paths **throw** on sync-registered models:

- `updateMany`, `deleteMany` — multi-document writes cannot stamp per-document seqs. Loop per document instead.
- `deleteOne` (query and document forms), `findOneAndDelete` — hard deletes are invisible to tombstone catch-up. Use soft delete (`doc.deleted = true; await doc.save()`).
- `Model.bulkWrite` **bypasses Mongoose middleware entirely** — it neither stamps nor throws. Do not use it on synced models; this is a documented restriction the plugin cannot enforce.

Sequencing guarantees: validation failures never consume a seq (the claim happens post-validation); the claim joins the caller's session when one is present, so caller-managed transactions get counter+write atomicity. A rare write failure after a claim burns a seq, which clients treat as a benign gap.

## Sync protocol

### HTTP (mounted by `SyncApp`, all authenticated)

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /sync/snapshot?collection=&cursor=&limit=` | Bootstrap + catch-up. Returns `{entities: [{id, data, seq, deleted}], cursor, hasMore}`. `cursor=0` = full snapshot (legacy docs without `_syncSeq` arrive in the first page with seq 0). Default page 500, max 1000. | Model `list` permissions + server-enforced scope filter |
| `POST /sync/mutate` | HTTP fallback for outbox replay (same handler as the socket channel). Body: `{mutationId, collection, operation, id?, data?, baseVersion?}`. Returns `{ack}` or `{nack}` with status 409 (conflict), 403 (unauthorized), 422 (validation), 429 (rate_limited, carries `retryAfterMs`), 500 (error). | modelRouter create/update/delete write path |
| `POST /sync/mutate/batch` | HTTP fallback for batched outbox replay. Body: `{mutations: SyncMutateRequest[]}` (max 100; intra-batch duplicate `mutationId`s rejected up front). Returns `{results: ({type:"ack",ack}\|{type:"nack",nack})[]}` — applied strictly in array order, stopping at the first non-ack (a shorter `results` array than the request means everything after it was never attempted). | modelRouter create/update/delete write path, per mutation |
| `GET /sync/key` | Caller's per-user key material for the server key provider (32 random bytes, base64; created on first call). | Own key only |

### Socket events (on the `RealtimeApp` Socket.io server)

| Event | Direction | Payload |
|---|---|---|
| `sync:subscribe` / `sync:unsubscribe` | client → server | `{collections: string[]}` — server resolves the user's streams from scope config (+ `getUserScopes`) and joins `sync:{stream}` rooms |
| `sync:subscribed` | server → client | `{collection, streams}` |
| `sync:error` | server → client | `{collection, message}` — per-collection subscribe failure (unknown collection, permission denied, missing resolver, cap exceeded) |
| `sync:delta` | server → client | `{collection, id, method, data?, seq, stream, deleted?}` — emitted by the change-stream watcher |
| `sync:mutate` | client → server | `{mutationId, collection, operation, id?, data?, baseVersion?}` (+ optional Socket.io ack callback) |
| `sync:ack` | server → client | `{mutationId, id, seq}` |
| `sync:nack` | server → client | `{mutationId, code: "conflict"\|"unauthorized"\|"validation"\|"error"\|"rate_limited", serverDoc?, serverSeq?, message?, retryAfterMs?}` — `rate_limited` (with `retryAfterMs`, the remaining window in ms) is never terminal: the client requeues and retries with unlimited backoff, exactly like a transport failure. |
| `sync:mutateBatch` | client → server | `{mutations: SyncMutateRequest[]}` (Socket.io ack callback carries `{results}`, same contract as the HTTP batch route) — a server with no handler for this event never invokes the ack callback, which the client treats as "batching unsupported" after a short grace timeout and falls back to single `sync:mutate` sends. |

Limits: 50 collection subscriptions per socket; 100 `sync:mutate` per second per socket, shared with `sync:mutateBatch` (each mutation in a batch counts individually against the same window); batches capped at 100 mutations.

### Conflicts and idempotency

The client sends `baseVersion` = the `_syncSeq` it last saw for the doc; a mismatch with the current `_syncSeq` yields a `conflict` nack carrying the canonical server doc + seq. The conflict lands in the local `_conflicts` table and surfaces through `useConflicts()`; resolve with `useServer` (accept the server doc) or `keepMine` (re-enqueue with a fresh baseVersion).

Every mutation is idempotent: the handler atomically claims a `SyncMutation` ledger row (unique `mutationId`) before applying, so a re-sent mutation (lost ack, socket retry racing the HTTP fallback) reads back the recorded outcome instead of double-applying.

## Encryption at rest (web)

Web persistence is **encrypted by default**: the store content is AES-256-GCM encrypted via Web Crypto before it touches IndexedDB. Key management is a pluggable `KeyProvider`:

- `createServerKeyProvider({appName, fetchKeyMaterial})` (**the default**: `createSyncDb` wires it automatically to `GET /sync/key` through its authenticated HTTP channel): fetches per-user key material, derives a non-extractable AES-256-GCM key via HKDF-SHA256 (salt = `{appName}:{userId}`), and caches the derived CryptoKey in IndexedDB so offline cold starts still decrypt. Server rotation of key material makes decryption fail — the client wipes local data, re-stamps the schema version, and runs a full re-bootstrap by default (always preceded by a `console.warn`); pass `onDecryptFailure` in `createSyncDb`'s config to override that default (e.g. prompt the user before wiping) instead.
- `createLocalKeyProvider()`: a random non-extractable CryptoKey generated on-device and cached in IndexedDB. No server dependency and no server-side copy of the key — strictly stronger for the at-rest case, at the cost of no server-driven rotation/revocation.

A storage **read** error (IndexedDB itself throwing — unavailable, blocked, or corrupted) is a distinct failure mode from "no data yet" or "undecryptable data": the client leaves the persisted blob untouched (no autosave-over) and surfaces `persistence: "error"` on `SyncStatus` instead of wiping. When `globalThis.indexedDB` is unavailable entirely (private-browsing modes that disable it, a locked-down embedded webview), the web persister factory falls back to in-memory persistence for the session (warns once) and reports `persistence: "memory"`.

```typescript
import {createLocalKeyProvider} from "@terreno/syncdb";

// Default: server-derived key, wired automatically — nothing to configure.
const syncDb = createSyncDb({name: "myapp", collections, authProvider, baseUrl});

// Opt out of the server-side key copy with a device-local key:
const localSyncDb = createSyncDb({
  name: "myapp",
  collections,
  authProvider,
  baseUrl,
  keyProvider: createLocalKeyProvider(),
});
```

**Threat model (stated explicitly):** the web encryption defends against **at-rest disk inspection of IndexedDB** (stolen/imaged device, backup scraping) and against a **stale store being readable after user switch** (per-user keys + wipe-on-user-change). It does **not** defend against XSS or any code executing on the origin — a non-extractable CryptoKey can still be *used* to decrypt in place — and with the server key provider the server can reconstruct any user's key (that is the trade for rotation/revocation; choose the local key provider where that is unacceptable). Server-side data is protected by MongoDB/infra controls, not this layer.

Native relies on the OS app sandbox: the expo-sqlite store is plaintext by design.

## Local store layout

One TinyBase `MergeableStore` per `{app, userId}` (wiped and re-bootstrapped on user change, or on a schema-version mismatch — see below):

```
tables:
  {collection}   → rowId = doc _id; cells: data (JSON string), seq, deleted, deletedAt,
                   pendingMutationId
  _outbox        → rowId = mutationId; cells: collection, operation, entityId, args (JSON),
                   baseVersion?, status (queued|inFlight|acked|conflicted|failed),
                   attemptCount, userId, createdAt, enqueueOrder
  _cursors       → rowId = stream; cells: seq, updatedAt
  _conflicts     → rowId = mutationId; cells: collection, entityId, localData, serverData,
                   serverSeq, dismissed
values: schemaVersion, lastUserId, outboxMaxEnqueueOrder
```

The outbox replays FIFO over the socket (HTTP fallback while disconnected), with per-user isolation: queued mutations record `userId` and replay skips on mismatch.

### Schema versioning

`SYNC_SCHEMA_VERSION` (`storage/schema.ts`) is stamped into the store's `schemaVersion` value on every `start()`. If a persisted store's stamped version doesn't match the running client's, the client treats it as a schema migration (not an auth event): wipe all local data, re-stamp the current version, and run a full snapshot re-bootstrap before `start()` resolves. Bump `SYNC_SCHEMA_VERSION` only when a table/cell shape change isn't safely backward-compatible (a new cell with a schema default, for example, does not need a bump).

### Client-side tombstone compaction

Deleted entities are kept locally as tombstones (`deleted: true`) with a `deletedAt` timestamp stamped the moment the tombstone is first applied (via a mutation, a delta, or a snapshot page). After each successful `reconcile()`, tombstones older than `tombstoneRetentionMs` (`createSyncDb` config, default 90 days) are deleted outright. Keep this in sync with the server's own tombstone retention (compaction script in `@terreno/api`) — compacting locally before the server's retention window elapses risks a client permanently missing a delete it hasn't converged on yet. Set `tombstoneRetentionMs: 0` to disable.

### Why MergeableStore (and the Yjs door)

`MergeableStore` is TinyBase's per-cell LWW CRDT (hybrid logical clocks) with a different on-disk format from the plain `Store`. Adopting it from day one avoids a per-device data migration later, and keeps the door open to a Yjs CRDT backend for collaborative structures (rich text) through the same persister/transport abstractions — without implementing Yjs now. The cost is roughly 2× storage overhead for the CRDT metadata, accepted for that readiness.

## Gap handling

Stream seqs are **not** contiguous from any one client's perspective — permission-filtered deltas legitimately skip numbers, and a failed write can burn a seq. Convergence therefore never depends on a gap proof:

- A **seq jump** in an incoming delta is treated as a *hint*: it triggers an HTTP reconcile (snapshot catch-up from the stream cursor), rate-limited to once per 30s per stream (`seqJumpReconcileMinIntervalMs`).
- Every **reconnect** triggers a reconcile plus an outbox replay.
- A **periodic reconcile** (default every 5 minutes, `reconcileIntervalMs`; 0 disables) guarantees convergence even for deltas missed with no observable jump.

Catch-up is a plain indexed query (`_syncSeq > cursor`, tombstones included), safe under concurrent writes because a doc's seq only ever increases.

## Known limitations

- **Synced models need a String `_id`** (or clients must mint ObjectId-format ids): offline clients generate entity ids (UUIDs) locally and the mutation channel writes them through as `_id`. A default ObjectId `_id` would cast-fail every client-side create. Declare `_id: {type: String, ...}` on synced schemas.
- **Multi-tab web**: two tabs of the same user share one IndexedDB blob; concurrent persister saves are last-writer-wins at the blob level and can drop the other tab's queued outbox rows. Single-writer coordination (Web Locks) is not implemented yet — avoid relying on offline writes from multiple simultaneous tabs.
- **`Model.bulkWrite` bypass**: bulkWrite skips Mongoose middleware, so it neither stamps seqs nor throws on synced models. Nothing can catch this server-side; it is a hard convention.
- **Native plaintext by design**: no SQLCipher; the OS sandbox is deemed sufficient.
- **Whole-store persistence**: each save serializes and (on web) encrypts the full store — cost scales with store size, not change size. Bound it by scoping which collections sync; saves are debounced.
- **`realtime` + `sync` coexistence**: a model may enable both (distinct events, `sync` vs `sync:delta`, so clients never double-apply), at the cost of double emission work. Treat `realtime` as deprecated for a model once `sync` is on.
- **Seq counter write amplification**: every synced write does an atomic `$inc` on a per-stream counter doc. Acceptable at current scale; Redis-based counters are the documented upgrade path.
