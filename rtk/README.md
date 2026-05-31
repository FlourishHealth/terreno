# @terreno/rtk

Redux Toolkit Query utilities for @terreno/api backends with React Native / Expo support.

## Features

- Authentication slice with JWT token management
- Secure token storage (SecureStore on mobile, AsyncStorage on web)
- Automatic token refresh
- Socket.io connection management with auth
- RTK Query base API with auth header injection
- OpenAPI SDK generation support

## Installation

This package is part of the terreno workspace. Add it as a dependency:

```bash
    bun install @terreno/rtk
```

## Usage

### Setting up the store

```typescript
import {generateAuthSlice} from "@terreno/rtk";
import {configureStore} from "@reduxjs/toolkit";
import {openapi} from "./openApiSdk";

const {authReducer, middleware} = generateAuthSlice(openapi);

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [openapi.reducerPath]: openapi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(openapi.middleware, ...middleware),
});
```

### Generating an OpenAPI SDK

Create an `openapi-config.ts` in your project:

```typescript
import type {ConfigFile} from "@rtk-query/codegen-openapi";

const config: ConfigFile = {
  apiFile: "@terreno/rtk",
  apiImport: "emptySplitApi",
  argSuffix: "Args",
  exportName: "openapi",
  flattenArg: true,
  hooks: true,
  outputFile: "./store/openApiSdk.ts",
  responseSuffix: "Res",
  schemaFile: "http://localhost:3000/openapi.json",
  tag: true,
};

export default config;
```

Then run the codegen:

```bash
npx @rtk-query/codegen-openapi openapi-config.ts
```

### Using socket connections

```typescript
import {useSocketConnection, getAuthToken, baseUrl} from "@terreno/rtk";

const {socket, isSocketConnected} = useSocketConnection({
  baseUrl,
  getAuthToken,
  shouldConnect: !!userId,
  onConnect: () => console.log("Connected"),
  onDisconnect: () => console.log("Disconnected"),
});
```

### Offline mode (opt-in)

Offline mode queues configured modelRouter mutations while the connection is offline or spotty, applies optimistic RTK Query cache updates, and replays when connectivity and auth recover.

```typescript
import {createOfflineMiddleware, useServerStatus} from "@terreno/rtk";
import {OfflineBanner, OfflineConflictList} from "@terreno/ui";

const offline = createOfflineMiddleware({
  api: terrenoApi,
  offline: {
    enabled: true,
    models: [
      {
        modelName: "Todo",
        tagType: "todos",
        endpoints: {
          create: {endpointName: "postTodos"},
          update: {endpointName: "patchTodosById"},
          delete: {endpointName: "deleteTodosById"},
        },
      },
    ],
    connectionQuality: {
      healthUrl: `${baseUrl}/health`,
      spottyLatencyMs: 1500,
    },
  },
});

// Store setup
// reducer: { offline: offline.offlineReducer }
// middleware: [..., offline.middleware]
// Persist the offline slice for queue survival across reloads.

const {
  connectionQuality,
  isOnline,
  queueLength,
  isSyncing,
  isReplayPausedForAuth,
  undismissedConflicts,
  resolveConflict,
} = useServerStatus({api: terrenoApi, skip: !userId});

<OfflineBanner
  connectionQuality={connectionQuality}
  isOnline={isOnline}
  isReplayPausedForAuth={isReplayPausedForAuth}
  isSyncing={isSyncing}
  queueLength={queueLength}
/>

<OfflineConflictList conflicts={undismissedConflicts} onResolve={resolveConflict} />
```

Key exports:

- `createOfflineMiddleware` — listener middleware + offline reducer
- `useServerStatus` / `useOfflineStatus` — connection quality, queue, auth-blocked, conflicts
- `resolveConflict` — `{conflictId, resolution: "keepMine" | "useServer"}`
- `selectConnectionQuality`, `selectQueuedMutations`, `selectConflicts`

See `docs/offline-mode-verification.md` for manual verification steps.

## Exports

- `generateAuthSlice` - Creates auth slice with login/logout/token management
- `generateProfileEndpoints` - RTK Query endpoints for auth operations
- `emptySplitApi` - Base RTK Query API with auth
- `createOfflineMiddleware` - Opt-in offline queue/replay middleware
- `useOfflineStatus`, `useServerStatus` - Offline/sync status hooks
- `useSocketConnection` - Socket.io connection hook
- `getAuthToken` - Get current auth token
- `baseUrl`, `baseWebsocketsUrl`, `baseTasksUrl` - URL constants from Expo config
- `IsWeb` - Platform detection helper
- `generateTags` - RTK Query tag generator for cache invalidation
- `ListResponse`, `populateId` - Mongoose list response utilities

