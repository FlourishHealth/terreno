# @terreno/syncdb Documentation

Local-first data layer for Terreno frontends. The on-device TinyBase store is the UI source of truth.

## Key exports

- `@terreno/syncdb`: `createSyncDb`, `betterAuthAdapter`, `wipeLocalData`, `listConflicts`
- `@terreno/syncdb/react`: `SyncDbProvider`, `useQuery`, `useEntity`, `useMutate`, `useSyncStatus`, `useConflicts`
- `@terreno/syncdb/testing`: `createFakeTransport`

## Quick start

```typescript
import {baseUrl} from "@terreno/rtk";
import {betterAuthAdapter, createSyncDb} from "@terreno/syncdb";
import {SyncDbProvider, useQuery, useMutate} from "@terreno/syncdb/react";

export const syncDb = createSyncDb({
  authProvider: betterAuthAdapter(authClient),
  baseUrl,
  collections: ["todos"],
  name: "my-app",
});

// In a screen:
const todos = useQuery<Todo>("todos");
const {create, update, remove} = useMutate("todos");
```

## Backend requirements

- `isDeletedPlugin` + `syncPlugin` on each synced schema
- `modelRouter("/path", Model, {sync: {...}, permissions, ...})`
- `SyncApp` + `RealtimeApp` on the Express app
- MongoDB replica set

## What syncdb replaces

Do **not** use RTK Query `useGetXQuery` / `usePostXMutation` for synced collections. Keep `bun run sdk` for non-synced routes (auth/me, admin, AI).

Full reference: [docs/reference/syncdb.md](https://github.com/FlourishHealth/terreno/blob/master/docs/reference/syncdb.md)

Migration: [docs/how-to/migrate-rtk-to-syncdb.md](https://github.com/FlourishHealth/terreno/blob/master/docs/how-to/migrate-rtk-to-syncdb.md)
