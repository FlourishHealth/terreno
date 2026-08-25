# @terreno/rtk

Redux Toolkit Query utilities for @terreno/api backends with React Native / Expo support.

> **Deprecation notice (56.0.0):** `@terreno/rtk` is **deprecated for data synchronization** as of version **56.0.0**. It remains published with a deprecation notice through the **current major line** (56.x beta and stable 0.x) and will **not** be published in the **next major** Terreno release. Superseded by [`@terreno/syncdb`](../syncdb/README.md) for collection reads/writes, offline sync, and realtime convergence.
>
> **Still use @terreno/rtk for:** generated OpenAPI SDK hooks (`bun run sdk`) on non-synced routes, Better Auth session Redux, feature flags, sockets, and legacy JWT auth during migration. See the [migration guide](../docs/how-to/migrate-rtk-to-syncdb.md).

> **Removed in Terreno 58:** `realtimeList`, `realtimeDocument`, `setRealtimeSocket`, and `getRealtimeSocket`. `modelRouter` `realtime` is also removed then. `RealtimeApp` stays for syncdb sockets.

> **Historical note:** the offline mutation queue (`createOfflineMiddleware`, `offlineSlice`, `configureOfflineMutationEndpoints`) and realtime cache patching (`realtimeList`, `realtimeDocument`) were superseded by `@terreno/syncdb` before this deprecation window.

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

## Exports

- `generateAuthSlice` - Creates auth slice with login/logout/token management
- `generateProfileEndpoints` - RTK Query endpoints for auth operations
- `emptySplitApi` - Base RTK Query API with auth
- `useSocketConnection` - Socket.io connection hook
- `getAuthToken` - Get current auth token
- `baseUrl`, `baseWebsocketsUrl`, `baseTasksUrl` - URL constants from Expo config
- `IsWeb` - Platform detection helper
- `generateTags` - RTK Query tag generator for cache invalidation
- `ListResponse`, `populateId` - Mongoose list response utilities

## Feature flags (OpenFeature)

`useFeatureFlags` and **`useTerrenoFeatureFlags`** wire Terreno’s `GET /feature-flags/flagConfiguration` into OpenFeature. Peer dependencies: **`@openfeature/react-sdk`** and **`@openfeature/web-sdk`** (install them in your app; do not rely on transitive copies).

Full upgrade steps (backend + frontend + SDK regen) live in the **Terreno root README**: [Feature flags: OpenFeature migration](../README.md#feature-flags-openfeature-migration).

