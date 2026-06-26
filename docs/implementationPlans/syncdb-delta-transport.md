# Implementation Plan: SyncDB Delta Protocol & Production WebSocket Transport

**Status:** Drafted (follow-up to `@terreno/syncdb` foundation, PR #835)
**Priority:** High
**Effort:** Large

## Context

`@terreno/syncdb` ships a complete local-first client engine (TinyBase
`MergeableStore` store, durable outbox, conflict store/resolver, cursor-aware
delta applier, ack/nack replay coordinator) behind a transport-agnostic
`SyncTransport` interface. Today the only concrete transport is the in-memory
`createFakeTransport` (tests) and a local "simulated server" in
`example-frontend` that just acks every mutation. There is **no real
server-side sync protocol** and **no production transport**.

This plan adds both, reusing the existing realtime stack rather than building a
parallel one:

- **Backend** already has `RealtimeApp` (`api/src/realtime/`): a Socket.io
  server with JWT auth (`@thream/socketio-jwt`), per-socket room subscriptions
  (`model:` / `document:` / `query:`), a MongoDB **change-stream watcher** that
  emits `sync` events (`{model, collection, method, id, data, updatedFields,
  timestamp}`) with per-recipient permission checks, owner/broadcast/model room
  strategies, DoS caps, and an optional Redis adapter for multi-instance.
- **Frontend** already has `useSocketConnection` (`rtk/src/socket.ts`): a
  socket.io-client manager with reconnect, JWT auth, token-refresh-on-disconnect,
  and disconnect toasts; plus `realtime.ts` (`realtimeList`/`realtimeDocument`)
  that patches RTK Query caches from `sync` events.

What the existing realtime layer is **missing** for local-first correctness:

1. **Monotonic cursors / sequence numbers** per stream so a client can resume
   from a known point and detect gaps. `RealtimeEvent.timestamp` is wall-clock
   ms (not monotonic, not gap-detectable).
2. **A mutation ingestion channel** that accepts client mutations by stable
   `mutationId` and returns **ack/nack** (the client currently can only write
   via REST; replay has nothing to talk to).
3. **Snapshot / bootstrap** (`since=cursor`) so a client that has been offline
   can catch up or cold-start without a full refetch.
4. **Per-entity version metadata** for optimistic concurrency and idempotent
   delta application (the applier already supports `version`, but the server
   never sends one).
5. **Conflict (`409`) responses** carrying canonical server doc + version.

## Core Concept

Introduce a thin **SyncDB protocol layer** on top of `RealtimeApp` that:

- assigns every change a **monotonic per-stream cursor**,
- exposes a **bootstrap endpoint** to fetch a snapshot + the current cursor (or a
  delta window since a cursor),
- accepts **mutations over the socket** (`sync:mutate`) and replies
  `sync:ack` / `sync:nack`, applying them through the existing `modelRouter`
  write path (so permissions, hooks, validation all still run),
- emits **`sync:delta`** events (the existing `sync` fanout, re-shaped to the
  syncdb `SyncDeltaEvent` with a cursor),

and a **`@terreno/syncdb` `createSocketIoSyncTransport`** that implements the
existing `SyncTransport` interface against that protocol, reusing the
`useSocketConnection` reconnection/token-refresh behavior.

The syncdb client engine already handles everything downstream of the
transport: idempotent delta application (monotonic cursor + per-entity version
guard), outbox replay, ack/nack → finalize/conflict/auth-pause/fail, and
conflict resolution. **No client-engine changes are required** beyond the new
transport and a small bootstrap hook.

## Streams & Cursors

A **stream** is the unit of ordered delivery and resumption. We scope a stream
to **`{collection}:{ownerId}`** for owner-strategy collections and
**`{collection}`** for model/broadcast collections. This matches the existing
room model (`user:{ownerId}` vs `model:{collection}`) and keeps each user's
cursor space independent (important for AC-10 isolation and for not leaking
another user's sequence activity).

### Cursor source — options

| Option | Monotonic? | Gap-detectable? | Multi-instance safe | Notes |
|---|---|---|---|---|
| **A. Change-stream resume token** | Yes (opaque, per-oplog) | No (opaque; can't tell "next") | Yes | Great for *resume*, weak for *gap detection* and per-stream ordering. |
| **B. Per-document `version` + `updatedAt`** | Per-doc only | No (no stream order) | Yes | Already needed for idempotency; insufficient as a stream cursor alone. |
| **C. Monotonic sequence assigned at write** | Yes, total order | Yes (contiguous ints) | Needs a shared counter | Cleanest local-first semantics. |

**Recommendation: C, with A as the transport-level resume fallback.** Assign a
monotonic `seq` per stream at mutation-commit time and store it on the document
(`_syncSeq`) plus in a lightweight **`SyncEvent`** log collection. The client's
cursor is the last `seq` it applied; gap detection is "did I skip a seq?".
Use the change-stream resume token only to drive the *server's* tail of the
`SyncEvent` log (so the watcher itself can resume after a restart).

A shared monotonic counter across instances is the main cost. Use one of:
- a per-stream counter doc (`findOneAndUpdate($inc)`, atomic) — simple, ~1 extra
  write per mutation; or
- Redis `INCR` per stream (fast) with periodic persistence; or
- a hybrid logical clock seq if we later move ordering fully client-side.

Start with the **per-stream counter doc** (no new infra) and document the Redis
upgrade path.

### SyncEvent log

```typescript
interface SyncEvent {
  stream: string;          // `${collection}` or `${collection}:${ownerId}`
  seq: number;             // monotonic within stream
  collection: string;
  entityId: string;
  op: "upsert" | "delete";
  version: string;         // entity version after the change (= _syncSeq or _v)
  data?: unknown;          // serialized doc (omitted for hard delete)
  mutationId?: string;     // origin mutation (for echo suppression / ack correlation)
  createdAt: string;       // ISO
}
```

Retained with a TTL (e.g. 7–30 days). Clients within the window resume via
`since=cursor`; clients older than the window fall back to a full snapshot
(server returns a `resync` signal).

## APIs

### Protocol messages (extend `syncdb/src/sync/types.ts`)

The client→server and server→client shapes already exist in the syncdb package
(`SyncMutationMessage`, `SyncSubscribeMessage`, `SyncDeltaEvent`, `SyncAckEvent`,
`SyncNackEvent`). The server must speak exactly these. Minor additions:

- `SyncDeltaEvent` already carries `{stream, cursor, changes[]}` — the server
  sets `cursor = seq` and `changes[].version = entity version`.
- `SyncAckEvent` already carries `{mutationId, version?, cursor?}` — server sets
  `version` (new entity version) and `cursor` (stream seq of the resulting delta)
  so the originating client can advance without waiting for the echo.
- `SyncNackEvent` already carries `{mutationId, reason, serverData?, version?}` —
  server sets `reason: "conflict"` + `serverData` + `version` on `409`,
  `"auth"` on token failure, `"validation"`/`"error"` otherwise.

### Socket events (server, added to `installRealtimeSocketHandlers`)

- `sync:subscribe` `{streams?, cursors?}` → server joins the corresponding rooms
  and, for each stream with a provided cursor, **replays missed `SyncEvent`s**
  (or returns `sync:resync {stream}` if the cursor is older than the retention
  window).
- `sync:mutate` `SyncMutationMessage` → server validates auth, applies the
  mutation idempotently, replies `sync:ack` / `sync:nack` to the **sender only**,
  and lets the change-stream/event-log fanout deliver `sync:delta` to everyone
  (including the sender, who suppresses the echo by `mutationId`).
- existing `subscribe:*` events remain for the RTK realtime path
  (back-compat; both protocols share the same socket server).

### HTTP bootstrap (new modelRouter-level route, gated by realtime)

- `GET /{collection}/sync/snapshot` → `{cursor, entities[]}` — current snapshot
  for the caller's authorized scope + the current stream cursor. Used on cold
  start and on `resync`.
- `GET /{collection}/sync/since?cursor=...` → `{cursor, changes[]}` — delta
  window (server may answer with `resync: true` if out of retention).

Both reuse the existing `modelRouter` query/permission/serialization stack
(`queryFilter`, `responseHandler`, `populatePaths`), so authorization and field
stripping are identical to REST.

### Mutation application (server)

`sync:mutate` is applied through the **same write path** as REST so we get
permissions, `preCreate`/`preUpdate` hooks, validation, and `responseHandler`
for free. Add:

- **Idempotency:** persist processed `mutationId`s (a capped `SyncMutationLog`
  collection or a unique index) so a replayed mutation after a lost ack is a
  no-op that re-acks rather than double-applies.
- **Optimistic concurrency:** honor `baseVersion`. If the current entity
  `version` ≠ `baseVersion`, reply `sync:nack {reason: "conflict", serverData,
  version}` instead of writing. (Reuse the `If-Unmodified-Since`/`_updatedAt`
  idea already present in `@terreno/rtk`'s offline queue.)
- **Versioning:** stamp every write with a new `version` (the assigned `seq`, or
  a per-doc `_v` increment) and include it in the resulting `SyncEvent`.

## Client: `createSocketIoSyncTransport`

A new export in `@terreno/syncdb` implementing `SyncTransport`:

```typescript
createSocketIoSyncTransport({
  baseUrl,
  getAuthToken,          // reuse rtk token util
  streams,               // streams to subscribe on connect
  getCursors,            // () => Record<stream, cursor> from the local store
}): SyncTransport
```

- `connect()` opens a socket.io connection mirroring `useSocketConnection`
  (reconnect with backoff, `auth: {token}`, token-refresh-on-disconnect). On
  `connect`, emits `sync:subscribe {streams, cursors}` using the client's
  persisted cursors (read from the syncdb cursors table via the delta applier).
- `onEvent` maps inbound `sync:delta` / `sync:ack` / `sync:nack` (and translates
  legacy `sync` events into `sync:delta` if we want one socket to serve both
  protocols during migration) to the syncdb `SyncServerEvent` union.
- `onStatus` maps socket connect/disconnect/reconnect to `connecting` /
  `connected` / `disconnected` — which the client already turns into
  `isOnline`/`isSyncing` and drives outbox replay + cursor-resumed subscribe.
- `send()` emits `sync:mutate` for mutation messages and `sync:subscribe` for
  subscribe messages.
- On `sync:resync {stream}`, the transport (or a thin bootstrap helper) calls
  `GET /{collection}/sync/snapshot`, applies it via `client.deltaApplier`/store,
  and resubscribes from the new cursor.

Because the engine already requeues in-flight mutations on disconnect and
replays on reconnect, the transport only has to faithfully translate the wire
protocol — no extra reconciliation logic on the client.

## Security & Isolation

- **Auth:** identical JWT handshake as `RealtimeApp`; `sync:mutate` re-checks
  permissions per mutation (never trust the client's claimed `ownerId`).
- **Stream authorization:** `sync:subscribe` reuses `getAuthorizedQuery` /
  owner-strategy checks so a user can only resume streams they may read; the
  `SyncEvent` replay path runs the same per-recipient permission check as the
  live fanout (`emitToAuthorizedRoom`).
- **Cross-user isolation (AC-10):** streams are owner-scoped; ack/nack go to the
  sender socket only; the client already calls `outbox.clearForOtherUsers` on
  user switch.
- **DoS:** extend the existing per-socket subscription caps to cover stream
  subscriptions; rate-limit `sync:mutate`.

## Multi-instance Scaling

- **Fanout:** the existing Redis adapter path (`RealtimeAppOptions.adapter:
  "redis"`) covers cross-instance room delivery.
- **Cursor monotonicity:** the per-stream counter doc (atomic `$inc`) is already
  cross-instance safe; if it becomes a hotspot, move to Redis `INCR`.
- **Echo suppression / ordering:** the `SyncEvent` log is the source of truth for
  order; instances tail it (or receive via change stream) so every instance
  delivers the same `seq` ordering.

## Feature Flags & Migration

- Reuse `USE_SYNCDB` (frontend) to choose the real transport; add
  `SYNCDB_TRANSPORT=socketio` config.
- Backend: gate the protocol behind the existing `BACKEND_SERVICE` websocket
  switch and a `realtime.syncProtocol: true` option on `RealtimeApp`, so the
  legacy RTK realtime path and the new syncdb protocol can run on the same socket
  server during migration (todos first, then more collections).
- No destructive data migration; adding `_syncSeq`/`_v` is additive (see the
  mongoose-schema-safety skill — backfill existing docs to `version: "0"` /
  seq 0 so first delta is monotonic).

## Phases

1. **Server: versioning + event log + cursors**
   - Add `_syncSeq`/`_v` stamping on writes; per-stream counter; `SyncEvent` log
     with TTL; populate it from the change-stream watcher (or write path).
2. **Server: bootstrap + since endpoints**
   - `GET /{collection}/sync/snapshot` and `/sync/since` via modelRouter.
3. **Server: mutation ingestion**
   - `sync:mutate` handler → write path with `mutationId` idempotency +
     `baseVersion` conflict detection; `sync:ack`/`sync:nack`.
4. **Server: cursor-aware subscribe + delta reshape**
   - `sync:subscribe {cursors}` with missed-event replay + `sync:resync`;
     reshape fanout to `sync:delta {stream, cursor, changes}`.
5. **Client: `createSocketIoSyncTransport`**
   - Implement `SyncTransport`; reuse reconnection/token-refresh; bootstrap on
     `resync`.
6. **Integration: example-frontend**
   - Replace the simulated transport with the real one behind `USE_SYNCDB`;
     enable `RealtimeApp` sync protocol + todos `realtime` config in
     example-backend; end-to-end two-client test.
7. **Hardening & docs**
   - Redis multi-instance, rate limits, retention tuning, observability
     (cursor-gap metrics), migration guide.

## Acceptance Criteria

These extend the existing syncdb ACs (AC-1..AC-10) with the now-real server.

- **AC-D1 (P0):** A mutation created offline replays on reconnect and is
  accepted (`sync:ack`); the queue drains and the row persists server-side after
  refresh. *(realizes AC-3 against a real server)*
- **AC-D2 (P0):** A second client receives the change as a `sync:delta` without
  manual refresh; a duplicated/replayed delta does not create a second row and
  reports no cursor-gap error. *(realizes AC-4)*
- **AC-D3 (P0):** A client offline past the retention window receives
  `sync:resync`, bootstraps from `/sync/snapshot`, and converges with no
  duplicates or missing rows.
- **AC-D4 (P1):** Concurrent edits to the same entity produce a `409`
  `sync:nack {reason:"conflict", serverData, version}`; `useServer` adopts the
  server doc+version, `keepMine` replays against the new version. *(realizes
  AC-5)*
- **AC-D5 (P1):** A replayed mutation after a lost ack is idempotent (no double
  apply) and re-acked.
- **AC-D6 (P1):** Expired token mid-replay yields `sync:nack {reason:"auth"}`;
  replay pauses (`authBlocked`), queue is preserved, and resumes after refresh.
  *(realizes AC-7)*
- **AC-D7 (P2):** With the Redis adapter and two server instances, a delta
  produced on instance A reaches a client connected to instance B in order.

## Task List (Bot Consumption)

### Phase 1: Versioning, cursors, event log
- [ ] **Task 1.1**: Add `_syncSeq`/`_v` stamping + per-stream monotonic counter (atomic `$inc`).
  - Files: `api/src/realtime/sequence.ts` (new), `api/src/plugins.ts`, tests.
- [ ] **Task 1.2**: `SyncEvent` model + TTL + writer from change-stream watcher.
  - Files: `api/src/realtime/syncEvent.ts` (new), `api/src/realtime/changeStreamWatcher.ts`, tests.

### Phase 2: Bootstrap endpoints
- [ ] **Task 2.1**: `GET /{collection}/sync/snapshot` and `/sync/since` via modelRouter, reusing query/permission/serialization.
  - Files: `api/src/realtime/syncRoutes.ts` (new), `api/src/api.ts` (wire), tests.

### Phase 3: Mutation ingestion
- [ ] **Task 3.1**: `sync:mutate` handler → write path with `mutationId` idempotency log + `baseVersion` conflict detection; emit `sync:ack`/`sync:nack`.
  - Files: `api/src/realtime/mutationIngest.ts` (new), `api/src/realtime/realtimeApp.ts`, `api/src/realtime/syncMutationLog.ts` (new), tests.

### Phase 4: Cursor-aware subscribe + delta reshape
- [ ] **Task 4.1**: `sync:subscribe {streams, cursors}` with missed-event replay + `sync:resync`.
  - Files: `api/src/realtime/realtimeApp.ts`, `api/src/realtime/syncEvent.ts`, tests.
- [ ] **Task 4.2**: Reshape fanout to `sync:delta {stream, cursor, changes[]}` (add cursor/version), keep legacy `sync` for RTK path.
  - Files: `api/src/realtime/changeStreamWatcher.ts`, tests.

### Phase 5: Client transport
- [ ] **Task 5.1**: `createSocketIoSyncTransport` implementing `SyncTransport` (reconnect, token refresh, subscribe-with-cursors, event mapping).
  - Files: `syncdb/src/sync/socketIoTransport.ts` (new), `syncdb/src/index.ts`, `syncdb/src/sync/socketIoTransport.test.ts` (new, fake socket).
- [ ] **Task 5.2**: Bootstrap helper for `sync:resync` (snapshot fetch → apply → resubscribe).
  - Files: `syncdb/src/sync/bootstrap.ts` (new), tests.

### Phase 6: Example integration
- [ ] **Task 6.1**: Enable `RealtimeApp` sync protocol + todos `realtime` config; swap example-frontend simulated transport for the real one behind `USE_SYNCDB`.
  - Files: `example-backend/src/server.ts`, `example-backend/src/api/todos.ts`, `example-frontend/store/syncdb.ts`.
- [ ] **Task 6.2**: Two-client e2e (delta dedupe, conflict, resync).
  - Files: `example-frontend/e2e/*` (Playwright), tests.

### Phase 7: Hardening + docs
- [ ] **Task 7.1**: Redis multi-instance validation, `sync:mutate` rate limit, retention/cursor-gap metrics.
- [ ] **Task 7.2**: Migration guide + protocol reference in `syncdb/README.md`.

## Risks & Mitigations

- **Cursor counter hotspot** → start with atomic counter doc; Redis `INCR`
  upgrade documented; per-stream (not global) keeps contention low.
- **Retention gaps causing silent divergence** → explicit `sync:resync` +
  snapshot bootstrap; cursor-gap metric/alert.
- **Double-apply on lost acks** → `mutationId` idempotency log + per-entity
  version guard (already in the applier).
- **Two protocols on one socket during migration** → namespace events
  (`sync:*` vs `subscribe:*`); feature-flag both ends; migrate one collection at
  a time.
- **Permission drift between REST and sync** → all sync reads/writes go through
  the same modelRouter permission/queryFilter/responseHandler code paths.
- **Ordering across instances** → `SyncEvent` log is the ordering source of
  truth; Redis adapter for fanout.

## Not Included / Future Work

- Field-level/semantic conflict merge (still keep-mine/use-server).
- CRDT-based server merge (MergeableStore is client-side; a Yjs/CRDT server is a
  separate effort).
- Backpressure/partial-sync for very large collections beyond snapshot+since.
- Non-Mongo backends.
