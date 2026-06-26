# @terreno/syncdb

Local-first data layer for Terreno apps. The on-device database is the primary
source of truth for the UI: reads come from a local store, writes apply
optimistically to local state and a durable outbox, and the server is treated as
asynchronous reconciliation rather than the source of immediate UI
responsiveness.

This package supersedes `@terreno/rtk` for data-synchronization concerns. It is
introduced behind a feature flag (`USE_SYNCDB`) so apps can migrate incrementally
while the existing RTK path keeps working.

## Architecture

Built on the [Expo local-first stack](https://docs.expo.dev/guides/local-first/):

- **State + persistence:** [TinyBase](https://tinybase.org) `MergeableStore`.
- **Native persistence:** `expo-sqlite` (via TinyBase's expo-sqlite persister).
- **Web persistence:** `localStorage` (via TinyBase's browser persister).
- **Mutations:** optimistic local writes + a durable, replayable outbox.
- **Sync (later phase):** websocket delta sync with cursor-aware, idempotent
  delta application and ack/nack-driven outbox replay.

```
            App UI (React)
                 │  local-first reads / optimistic writes
                 ▼
        @terreno/syncdb client
   ┌─────────────┬───────────────┐
   │  SyncStore  │    Outbox     │   (TinyBase MergeableStore tables)
   └─────────────┴───────────────┘
                 │  persister (platform-resolved)
                 ▼
   expo-sqlite (native)  /  localStorage (web)  /  in-memory (Node/SSR)
```

### Why `MergeableStore` (and the Yjs door)

We use TinyBase's `MergeableStore` (a CRDT built on hybrid logical clocks) from
day one rather than a plain `Store`. The two have **different on-disk
serialization formats**, so switching later would require a client-side data
migration on every device. Adopting `MergeableStore` now keeps the local data
CRDT-ready and avoids that painful migration.

This deliberately **leaves the door open for Yjs** without implementing it yet:
Yjs would slot in as an alternative CRDT/persistence backend behind the same
store factory and persister abstraction, and the app-facing data shapes
(entities/outbox) would not change. Yjs is only warranted for richer
collaborative structures (e.g. shared text); `MergeableStore` already covers the
record-level sync this layer needs.

## Status

This is the **foundation** slice of the [syncdb implementation plan](../docs/implementationPlans/syncdb-local-first.md).

Implemented:

- Package scaffold and canonical storage/outbox/cursor/conflict type contracts.
- Schema-bound TinyBase `MergeableStore` with typed, collection-aware entity
  accessors (upsert / get / list / soft + hard delete / clear).
- Persistence abstraction with platform default factories (expo-sqlite, local
  storage) and an in-memory persister for tests/SSR.
- Durable outbox state machine with deterministic lifecycle transitions and
  per-user replay isolation.
- `createSyncDbClient` lifecycle (start / save / destroy), aggregate sync status,
  and transport-driven status setters.

Also implemented:

- Conflict store + `useServer`/`keepMine` resolver.
- Encryption at rest: pluggable `PayloadCodec` (AES-GCM via Web Crypto) and a
  key-value persister that encrypts the serialized store blob (opt-in via
  `createEncryptedPersisterFactory`).

Not yet implemented (later phases):

- Websocket delta-sync transport and cursor-aware delta applier.
- React hooks/provider and the Redux migration bridge.
- `example-frontend` todos integration behind `USE_SYNCDB`.
- `@terreno/syncdb-codegen`.

## Usage (foundation API)

```typescript
import {createSyncDbClient} from "@terreno/syncdb";

const client = createSyncDbClient({databaseName: "myapp-syncdb"});
await client.start();

// Local-first read
const todos = client.store.getCollectionEntities({collection: "todos"});

// Optimistic local write + durable outbox enqueue
client.store.upsertEntity({collection: "todos", id: "t1", data: {title: "Buy milk"}});
client.outbox.enqueue({collection: "todos", operation: "create", args: {title: "Buy milk"}});

// Aggregate sync status (for status banners)
const {queuedCount, isOnline, conflictCount} = client.getSyncStatus();
```

### Testing

```bash
bun run --filter '@terreno/syncdb' test
bun run --filter '@terreno/syncdb' compile
bun run --filter '@terreno/syncdb' lint
```

Tests run against the real TinyBase store and an in-memory persister (no mocked
store, no native modules), so behavior is exercised end-to-end in pure JS.
