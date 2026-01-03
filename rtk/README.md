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

