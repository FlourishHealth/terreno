---
description: '@terreno/rtk - Redux Toolkit Query utilities for Terreno frontends'
applyTo: '**/*'
---
# @terreno/rtk

Redux Toolkit Query utilities for frontends connecting to @terreno/api backends. Provides JWT authentication, token management, SDK code generation support, and Socket.io integration. This is a **frontend state management** package — no Express, no Mongoose, no backend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### File Structure

```
src/
  index.ts               # All exports
  authSlice.ts           # generateAuthSlice - JWT auth with Redux
  emptyApi.ts            # Base RTK Query API with retry and token refresh
  socket.ts              # useSocketConnection hook
  constants.ts           # Base URL resolution, debug flags
  mongooseSlice.ts       # List response utilities
  tagGenerator.ts        # Cache invalidation tag generation
  platform.ts            # Web platform detection
  platform.native.ts     # Native platform detection
```

## generateAuthSlice

Creates a complete Redux auth system from an RTK Query API instance.

### Usage

```typescript
import {generateAuthSlice} from "@terreno/rtk";

const {authReducer, authSlice, logout, setUserId, tokenRefreshedSuccess, middleware} =
  generateAuthSlice(api);

// Add to Redux store
const store = configureStore({
  reducer: {
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware, ...middleware),
});
```

### What It Returns

| Export | Type | Description |
|--------|------|-------------|
| `authReducer` | Reducer | Auth state reducer |
| `authSlice` | Slice | Full Redux slice |
| `logout` | Action | Clears tokens from storage, resets state |
| `setUserId` | Action | Sets current user ID |
| `tokenRefreshedSuccess` | Action | Signals token was refreshed |
| `middleware` | Middleware[] | Login/logout listener middleware |

### Auth State

```typescript
{userId: string | null, error: string | null, lastTokenRefreshTimestamp: number | null}
```

### Built-in Endpoints

`generateAuthSlice` adds these endpoints to the API:

- `emailLogin` — POST `/auth/login` (no retries)
- `emailSignUp` — POST `/auth/signup`
- `googleLogin` — POST `/auth/google` (no retries)
- `createEmailUser` — Create user without login (admin use)
- `resetPassword` — POST `/resetPassword`

### Token Storage

Automatic via listener middleware:
- **Native (iOS/Android):** `expo-secure-store` for secure encrypted storage
- **Web:** `@react-native-async-storage/async-storage` with SSR safety checks
- Tokens stored: `AUTH_TOKEN` and `REFRESH_TOKEN`
- On login success: stores tokens, dispatches `setUserId`
- On logout: removes tokens from storage

### Selectors

```typescript
import {selectCurrentUserId, useSelectCurrentUserId} from "@terreno/rtk";

const userId = useSelectCurrentUserId();  // Hook version
const userId = selectCurrentUserId(state);  // Selector version
```

## emptyApi — Base RTK Query API

Pre-configured RTK Query API with authentication, retry logic, and token refresh.

### Features

- **Axios with retry:** 3 retries with exponential backoff
- **Automatic token refresh:** Refreshes auth token when < 2 minutes from expiry
- **Mutex locking:** Prevents simultaneous token refreshes across concurrent requests
- **401 handling:** Auto-refreshes token on 401 responses, retries the request
- **Mutation safety:** Mutations don't retry on non-401 errors (prevents duplicates)
- **Query serialization:** Uses `qs.stringify()` for complex queries ($in, $lt, $gte)

### Base URL Resolution (priority order)

1. `Constants.expoConfig?.extra?.BASE_URL` (production/staging)
2. `process.env.EXPO_PUBLIC_API_URL` (dev web)
3. `Constants.expoConfig?.hostUri` + `:3000` (dev simulator/device)
4. `http://localhost:3000` (fallback)

### Response Handling

- 204 responses return null
- List endpoints return full response: `{data, more, page, limit, total}`
- CRUD endpoints extract and return `result.data`

### Headers Added Automatically

- `authorization: Bearer <token>`
- `App-Version` from Expo config
- `App-Platform` ("web" or "mobile")

## SDK Code Generation

Frontend apps generate typed RTK Query hooks from the backend's OpenAPI spec.

### Configuration (openapi-config.ts)

```typescript
const config: ConfigFile = {
  apiFile: "@terreno/rtk",
  apiImport: "emptySplitApi",
  outputFile: "./store/openApiSdk.ts",
  schemaFile: "http://localhost:4000/openapi.json",
  hooks: true,
  tag: true,
  flattenArg: true,
};
```

### Workflow

1. Start backend: `bun run backend:dev`
2. Generate SDK: `cd example-frontend && bun run sdk`
3. Import generated hooks: `import {useGetTodosQuery} from "@/store/openApiSdk"`

### Critical Rules

- **Never modify `openApiSdk.ts` manually** — it is auto-generated
- **Never use `axios` or `fetch` directly** — always use generated hooks
- Regenerate SDK after any backend route changes

## useSocketConnection

Socket.io integration with auto-reconnection and token refresh.

```typescript
import {useSocketConnection} from "@terreno/rtk";

const {socket, isSocketConnected} = useSocketConnection({
  baseUrl: "wss://ws.example.com",
  shouldConnect: !!userId,
  getAuthToken: () => getAuthToken(),
  onConnect: () => console.info("Connected"),
  onDisconnect: () => console.warn("Disconnected"),
});
```

### Features

- WebSocket transport only, reconnection with 5 attempts
- Bearer token authentication via `socket.auth`
- Auto-reconnects on token refresh
- Disconnect toast after 9+ seconds
- Token expiration checks on disconnect/error
- SSR-safe (checks `typeof window`)

## Tag Generator

Auto-generates RTK Query cache tags for endpoints:

```typescript
import {providesIdTags, invalidatesIdTags} from "@terreno/rtk";

// Provides tags for list queries (individual items + collection)
providesIdTags("todos")

// Invalidates tags for mutations
invalidatesIdTags("todos")
```

## Constants & Debug

```typescript
import {LOGOUT_ACTION_TYPE, logAuth, logSocket} from "@terreno/rtk";

// Debug logging (enabled via expoConfig.extra.AUTH_DEBUG / WEBSOCKETS_DEBUG)
logAuth("Token refreshed", {userId});
logSocket("Connected", {socketId});
```

## Token Utilities

```typescript
import {getAuthToken, getTokenExpirationTimes, shouldShowStillThereModal} from "@terreno/rtk";

const token = await getAuthToken();  // Get current token from storage
const {authRemainingSecs, refreshRemainingSecs} = getTokenExpirationTimes();
const showModal = shouldShowStillThereModal();  // true if refresh token expires in <= 65s
```
