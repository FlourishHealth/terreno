# How to Migrate from @terreno/rtk to @terreno/syncdb

`@terreno/syncdb` supersedes `@terreno/rtk` for **data-synchronization concerns**: server-fetched reads, CRUD writes, the offline mutation queue, and realtime cache patching. It does not replace rtk wholesale — the generated OpenAPI SDK and legacy JWT auth stay on rtk (see [What stays on rtk](#what-stays-on-rtk-for-now)).

## Prerequisites

- Backend on `@terreno/api` with `RealtimeApp` running (MongoDB replica set — change streams power delta emission)
- Frontend using `@terreno/rtk` generated hooks today
- Read the [`@terreno/syncdb` README](../../syncdb/README.md) for the full architecture

## Side-by-side mapping

| Concern | @terreno/rtk | @terreno/syncdb |
|---|---|---|
| List reads | `useGetTodosQuery({completed: false})` | `useQuery("todos", {filter: (t) => !t.completed})` |
| Single-doc reads | `useGetTodosByIdQuery(id)` | `useEntity("todos", id)` |
| Writes | `usePostTodosMutation()`, `usePatchTodosByIdMutation()`, `useDeleteTodosByIdMutation()` | `useMutate("todos")` → `{create, update, remove}` |
| Offline queue | `createOfflineMiddleware` + `offlineSlice` + `configureOfflineMutationEndpoints` | Built-in durable outbox (`_outbox` table, survives reload) |
| Realtime | `realtimeList("todos")` / `realtimeDocument("todos")` cache patching over `useSyncConnection` | Automatic — `sync:delta` events apply straight to the local store |
| Offline/sync status | `useOfflineStatus()` + `selectQueueLength` / `selectIsSyncing` | `useSyncStatus()` → `{isOnline, isSyncing, queuedCount, conflictCount, streams}` |
| Conflicts | 409 responses via `If-Unmodified-Since` header, `ConflictRecord`s in `offlineSlice` | `baseVersion` conflict nacks + `useConflicts()` → `{conflicts, resolve}` |
| Auth | `generateAuthSlice` (JWT + Redux) | Better Auth client + `betterAuthAdapter` (no Redux) |
| State container | Redux store + RTK Query cache | TinyBase `MergeableStore` (no Redux) |

## Reads

RTK Query hooks fetch on mount and cache per-endpoint; syncdb hooks read the local store synchronously and re-render via TinyBase listeners. There is no `isLoading` for reads — after bootstrap the data is simply there (offline included).

```typescript
// Before (rtk)
const {data, isLoading, error, refetch} = useGetTodosQuery({completed: false});
const todos = data?.data ?? [];

// After (syncdb)
import {useQuery} from "@terreno/syncdb/react";
const todos = useQuery<Todo>("todos", {filter: (t) => !t.completed});
```

`useQuery` filters and sorts in JS over decoded local entities; there are no server query params. Tombstoned (soft-deleted) entities are excluded unless `{includeDeleted: true}`.

## Writes

```typescript
// Before (rtk)
const [createTodo] = usePostTodosMutation();
await createTodo({title, completed: false}).unwrap();

// After (syncdb)
import {useMutate} from "@terreno/syncdb/react";
const {create, update, remove} = useMutate("todos");
const {id, mutationId} = create({data: {title, completed: false}});
update({id, data: {completed: true}}); // merges fields
remove({id});                          // soft delete
```

Mutations are synchronous from the caller's perspective: they apply to the local store immediately, enqueue in the durable outbox, and replay to the server in the background (socket `sync:mutate`, HTTP `POST /sync/mutate` fallback). There is no `.unwrap()` — server rejection surfaces later as a nack (conflicts land in `useConflicts()`; other failures mark the outbox row `failed`). Server-side, every mutation runs the same modelRouter write path (permissions, `preCreate`/`preUpdate` hooks, validation) as REST.

## Offline queue

rtk's `createOfflineMiddleware` intercepted failed RTK Query mutations into a Redux-persisted queue and replayed them with `If-Unmodified-Since` LWW headers. In syncdb the outbox is not a bolt-on: **every** mutation goes through it, online or offline, so there is nothing to configure per endpoint (`configureOfflineMutationEndpoints` has no equivalent). The outbox persists in the local store, survives reloads, replays FIFO, and records `userId` so one user's queue never replays as another (ported from the rtk middleware's per-user isolation).

## Realtime

rtk needed explicit cache patching per endpoint (`realtimeList`/`realtimeDocument` wired into `onCacheEntryAdded`, plus `useSyncConnection` to manage the socket). syncdb subscribes to its collections once (`sync:subscribe` on connect) and applies `sync:delta` events directly to the local store — every `useQuery`/`useEntity` re-renders automatically. There is no per-endpoint wiring to migrate; delete it.

A model may keep `realtime` and `sync` enabled simultaneously during migration — the events are distinct (`sync` for the legacy rtk path, `sync:delta` for syncdb) so clients never double-apply. Treat `realtime` as deprecated for a model once `sync` is on.

## Auth

syncdb consumes a narrow `AuthProvider` interface (`{getToken, getUserId, onAuthChange}`) instead of a Redux auth slice. The shipped adapter wraps a Better Auth client:

```typescript
import {createBetterAuthClient} from "@terreno/rtk";
import {betterAuthAdapter, createSyncDb} from "@terreno/syncdb";

const authClient = createBetterAuthClient({baseURL: API_URL});
const syncDb = createSyncDb({
  authProvider: betterAuthAdapter(authClient),
  baseUrl: API_URL,
  collections: ["todos"],
  name: "myapp",
});
```

On login/user switch the adapter fires `onAuthChange`; syncdb wipes the previous user's local data and re-bootstraps. If your app is still on `generateAuthSlice` JWTs, migrate auth to Better Auth first (see [Configure Better Auth](configure-better-auth.md)) — the server's socket layer accepts Better Auth sessions via `new RealtimeApp({betterAuth: {auth, userModel}})` alongside legacy JWTs, so the two can coexist during the transition.

## Conflicts

rtk detected concurrent edits with `If-Unmodified-Since` timestamps and 409 responses. syncdb uses the same LWW semantics on a monotonic integer: each mutation carries `baseVersion` (the `_syncSeq` the client last saw); a mismatch nacks `conflict` with the canonical server doc. Both checks share one server code path (the extracted update executors), so behavior is consistent across REST and sync.

```typescript
import {useConflicts} from "@terreno/syncdb/react";

const {conflicts, resolve} = useConflicts();
// conflicts: [{mutationId, collection, entityId, localData, serverData, serverSeq, dismissed}]
resolve({mutationId, strategy: "useServer"}); // accept the server doc
resolve({mutationId, strategy: "keepMine"});  // re-enqueue with a fresh baseVersion
```

Render these in a conflict sheet (local vs server side by side) instead of rtk's `selectUndismissedConflicts` UI.

## What stays on rtk for now

- **Generated OpenAPI SDK hooks** for everything that is not a synced collection: custom routes, `collectionActions`/`instanceActions` RPC endpoints, admin routes, reports, file uploads. Keep running `bun run sdk` and using the generated hooks for these.
- **Legacy JWT auth** (`generateAuthSlice`, token refresh, `emptyApi`) until the app completes its Better Auth migration.
- `@terreno/rtk` is not being removed — its offline queue and realtime cache patching are deprecated in favor of syncdb, the rest remains supported.

## Incremental adoption

Adopt per collection, behind a flag:

1. Enable `sync` on one model (todos is the canonical first candidate) while leaving its REST routes and `realtime` config untouched — REST and sync share the same write path, so both stacks stay consistent.
2. Gate the frontend with a feature flag (e.g. a `USE_SYNCDB` boolean via the existing OpenFeature infra / `useTerrenoFeatureFlags`): flag off renders the existing RTK Query screen, flag on renders the syncdb version. Both can ship in the same bundle.
3. Verify parity (CRUD, offline create/update/delete, reconnect catch-up, conflict resolution, user switch), then flip the flag default and delete the RTK path for that screen.
4. Repeat per collection. Non-synced endpoints stay on the generated SDK indefinitely.

## Backend prerequisites checklist

Before a collection can sync:

- [ ] The schema applies `isDeletedPlugin` — sync **requires soft delete**; hard-delete models cannot register (catch-up depends on tombstones).
- [ ] The schema applies `syncPlugin` (from `@terreno/api`) — stamps `_syncSeq`/`_syncPrevStream`. Plugins must be applied before the model compiles; registration validates their presence.
- [ ] The route uses the three-argument `modelRouter("/path", Model, {sync: {...}})` form with a `scope` (`owner`/`tenant`/`broadcast`/custom resolver).
- [ ] Custom resolver scopes also define `snapshotFilter` (validated at registration).
- [ ] `new SyncApp({...})` is registered — with `getUserScopes` if any model is tenant- or custom-scoped.
- [ ] `new RealtimeApp({...})` is registered and MongoDB runs as a replica set.
- [ ] No code path calls `updateMany`, `deleteMany`, `deleteOne`, `findOneAndDelete`, or hard deletes on the model — these **throw** on synced models. Refactor to per-document loops with soft delete.
- [ ] No code path calls `Model.bulkWrite` on the model — it bypasses Mongoose middleware entirely (no seq stamping, no guard) and will silently break catch-up.
- [ ] (Recommended) Better Auth configured (`BetterAuthApp`) and passed to `RealtimeApp({betterAuth})` so sockets authenticate with sessions; legacy JWT sockets keep working meanwhile.
