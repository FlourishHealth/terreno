# Auth and Tokens — Terreno

## generateAuthSlice

`generateAuthSlice(api)` from `@terreno/rtk` creates:

- `authReducer` — tracks `userId`, `error`, `lastTokenRefreshTimestamp`
- `logout` action — clears tokens from secure storage
- `middleware` — stores tokens on login, removes on logout
- Built-in endpoints: `emailLogin`, `emailSignUp`, `googleLogin`, `resetPassword`

## Login

```tsx
import {useEmailLoginMutation} from "@/store/sdk";
import {useSelectCurrentUserId} from "@terreno/rtk";

const [login, {isLoading, error}] = useEmailLoginMutation();

await login({email, password}).unwrap();
// Tokens stored automatically; setUserId dispatched
```

## Logout

```tsx
import {useAppDispatch, logout} from "../store/index.ts";

const dispatch = useAppDispatch();
dispatch(logout());
// Clears AUTH_TOKEN and REFRESH_TOKEN from storage
```

## Token storage

- **Native:** `expo-secure-store` (encrypted)
- **Web:** `@react-native-async-storage/async-storage` (SSR-safe wrapper)

Never store tokens in plain AsyncStorage on native or in `EXPO_PUBLIC_*` env vars.

## Token refresh

`emptyApi` from `@terreno/rtk` automatically:

- Refreshes access token when < 2 minutes from expiry
- Retries failed requests after 401 with refreshed token
- Uses a mutex to prevent concurrent refresh storms

No manual refresh logic needed in app code.

## Better Auth (optional)

For apps using Better Auth instead of JWT/Passport:

```tsx
import {createBetterAuthClient, generateBetterAuthSlice} from "@terreno/rtk";

const authClient = createBetterAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  basePath: "/api/auth",
});

const {betterAuthReducer, actions, selectors, middleware} =
  generateBetterAuthSlice(authClient);
```

Use `SocialLoginButton` from `@terreno/ui` for OAuth providers.

## Current user

```tsx
import {useSelectCurrentUserId} from "@terreno/rtk";
import {useReadProfile} from "@/hooks/useReadProfile"; // app-specific

const userId = useSelectCurrentUserId();
const {data: profile} = useReadProfile(); // GET /auth/me via sdk.ts
```

## Protected routes

Gate navigation on `userId` in root `_layout.tsx`. Redirect unauthenticated users to `/login`.

For admin routes, also check `user.admin === true` and redirect non-admins.
