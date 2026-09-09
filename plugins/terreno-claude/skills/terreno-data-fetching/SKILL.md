---
name: terreno-data-fetching
description: >-
  Use when implementing or debugging ANY network request, API call, or data
  fetching in a Terreno app. Covers RTK Query generated hooks, generateAuthSlice,
  token management, realtime sockets, caching, and SDK
  regeneration. Replaces raw fetch, axios, React Query, and SWR in Terreno apps.
  Lifecycle composition: Grow for data-flow shape, Pick for implementation, Roast
  for independent network/cache behavior proof.
---
# Terreno Data Fetching

**You MUST use this skill for ANY networking work in Terreno apps.** Never use `axios`, raw `fetch`, React Query, or SWR — use generated RTK Query hooks from `@terreno/rtk`.

**Related skills:** `generate-sdk` (regenerate hooks after backend changes), `terreno-backend-api` (create backend routes), `building-terreno-apps` (screen integration).

## Documentation

1. Read `docs/reference/syncdb.md`, `docs/how-to/migrate-rtk-to-syncdb.md`, and auth/realtime explanation pages before changing fetch, cache, or session behavior.
2. Implement against that design.
3. Update those pages in the same slice with `update-docs`.
4. Ship without matching docs is a failed slice.

## References

```
references/
  auth-and-tokens.md     generateAuthSlice, login/logout, token refresh
  realtime.md             Sockets, feature flags, server status
  sdk-customization.md   injectEndpoints, cache tags, hand-maintained sdk.ts
```

## When to Use

- Implementing API requests in screens or hooks
- Setting up authentication (login, logout, token refresh)
- Debugging network failures or stale data
- Connecting realtime updates (sockets, feature flags)
- Configuring API URLs and environment variables
- After any backend route or model change (regenerate SDK)

## Core Rules

1. **Always use generated hooks** from `store/openApiSdk.ts` (or `store/sdk.ts` exports).
2. **Never edit `openApiSdk.ts` manually** — regenerate with `generate-sdk` skill.
3. **Never use `axios` or raw `fetch`** in app code — RTK Query handles retries, auth headers, and token refresh.
4. **Customize in `sdk.ts`** via `injectEndpoints` / `enhanceEndpoints` — that file is hand-maintained.
5. **Use `.unwrap()`** on mutations to get typed errors in try/catch.

## Quick Start

### Query (read data)

```tsx
import {useGetTodosQuery} from "@/store/sdk";

const TodosScreen: React.FC = () => {
  const {data, isLoading, error, refetch, isFetching} = useGetTodosQuery({
    completed: false,
  });

  // data shape for list endpoints: {data: Todo[], page, limit, total, more}
  const todos = data?.data ?? [];
};
```

### Mutation (write data)

```tsx
import {usePostTodosMutation, usePatchTodosByIdMutation} from "@/store/sdk";

const [createTodo, {isLoading: isCreating}] = usePostTodosMutation();
const [updateTodo] = usePatchTodosByIdMutation();

const handleCreate = useCallback(async (): Promise<void> => {
  try {
    await createTodo({title: "New todo", completed: false}).unwrap();
  } catch (err) {
    console.error("Create failed", err);
  }
}, [createTodo]);

const handleToggle = useCallback(async (id: string, completed: boolean): Promise<void> => {
  try {
    await updateTodo({id, completed: !completed}).unwrap();
  } catch (err) {
    console.error("Update failed", err);
  }
}, [updateTodo]);
```

### Auth

```tsx
import {generateAuthSlice} from "@terreno/rtk";
import {terrenoApi} from "@/store/sdk";

const {authReducer, logout, middleware} = generateAuthSlice(terrenoApi);

// In a component:
import {useEmailLoginMutation} from "@/store/sdk";
import {useSelectCurrentUserId} from "@terreno/rtk";

const [login] = useEmailLoginMutation();
const userId = useSelectCurrentUserId();
```

See `./references/auth-and-tokens.md` for the full auth flow.

## Redux Store Setup

```tsx
import {configureStore} from "@reduxjs/toolkit";
import {generateAuthSlice} from "@terreno/rtk";
import {terrenoApi} from "./sdk";

const authSlice = generateAuthSlice(terrenoApi);

const store = configureStore({
  reducer: {
    auth: authSlice.authReducer,
    [terrenoApi.reducerPath]: terrenoApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(terrenoApi.middleware, ...authSlice.middleware),
});

export const {logout} = authSlice;
```

See `example-frontend/store/index.ts` for persist and Sentry integration.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Backend URL for web dev (e.g. `http://localhost:4000`) |
| `EXPO_PUBLIC_DEV_API_PORT` | Dev API port when using Expo host URI (default `4000`) |
| `expo.extra.BASE_URL` | Production/staging API URL in `app.json` |

Base URL resolution priority (from `@terreno/rtk`):

1. `expo.extra.BASE_URL`
2. `EXPO_PUBLIC_API_URL`
3. Expo dev server host + dev API port
4. `http://localhost:4000`

Never put server secrets in `EXPO_PUBLIC_*` variables.

## Error Handling

RTK Query exposes errors on the hook result:

```tsx
const {error, isError} = useGetTodosQuery({});

if (isError) {
  // error is FetchBaseQueryError | SerializedError
  console.error("Query failed", error);
}
```

For mutations, use `.unwrap()`:

```tsx
try {
  await createTodo(body).unwrap();
} catch (err) {
  // Handle APIError-shaped responses from @terreno/api
  console.error("Mutation failed", err);
}
```

Use `isNetworkFetchError` from `@terreno/rtk` to detect connectivity issues in error UI.

## SDK Regeneration

After **any** backend API change, run the `generate-sdk` skill:

```bash
# Backend running on :4000, then:
cd example-frontend && bun run sdk
```

Triggers: new `modelRouter`, custom routes, schema field changes, permission changes, OpenAPI builder edits.

## Decision Tree

```
Need data in a Terreno app?
  |-- Reading from API?
  |   \-- useGet*Query from generated SDK
  |
  |-- Writing to API?
  |   \-- usePost/Patch/Delete*Mutation + .unwrap()
  |
  |-- Login/logout?
  |   \-- references/auth-and-tokens.md
  |
  |-- Realtime updates?
  |   \-- references/realtime.md (useSocketConnection)
  |
  |-- Custom endpoint not in SDK?
  |   |-- Backend exists? -> generate-sdk first
  |   \-- App-only extension? -> references/sdk-customization.md
  |
  |-- Backend doesn't exist?
  |   \-- terreno-backend-api, then generate-sdk
  |
  \-- Using axios/fetch/React Query?
      \-- STOP — migrate to RTK Query hooks
```

## Common Mistakes

**Wrong: axios**

```tsx
const result = await axios.get("/todos");
```

**Right: generated hook**

```tsx
const {data} = useGetTodosQuery({});
```

**Wrong: manual token in fetch**

```tsx
fetch(url, {headers: {Authorization: `Bearer ${token}`}});
```

**Right: RTK handles auth automatically**

```tsx
// emptyApi from @terreno/rtk adds Bearer token and refreshes on 401
const {data} = useGetTodosQuery({});
```

**Wrong: editing openApiSdk.ts**

```tsx
// Adding a new endpoint by hand
```

**Right: regenerate or inject**

```bash
cd example-frontend && bun run sdk
# or injectEndpoints in store/sdk.ts for app-specific extensions
```

## Example Invocations

- "How do I fetch todos?" → `useGetTodosQuery` from `@/store/sdk`
- "How do I handle login?" → `useEmailLoginMutation` + `generateAuthSlice`
- "Should I use React Query?" → No — RTK Query via generated hooks
- "API calls return 401" → Check token refresh; see auth-and-tokens.md
- "Hooks are missing after backend change" → Run `generate-sdk` skill
- "How do I add a custom endpoint?" → Backend route + OpenAPI, then sdk.ts injectEndpoints
