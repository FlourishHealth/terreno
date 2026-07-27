# Offline and Realtime — Terreno

## Offline mutation queue

`createOfflineMiddleware` from `@terreno/rtk` queues mutations when offline and replays them when connectivity returns.

```tsx
import {createOfflineMiddleware} from "@terreno/rtk";
import {terrenoApi} from "./sdk";

const offlineConfig = createOfflineMiddleware({
  api: terrenoApi,
  endpoints: ["postTodos", "patchTodosById", "deleteTodosById"],
});

// Add offlineConfig.middleware and offlineConfig.reducer to the store
```

Show `OfflineBanner` from `@terreno/ui` when offline. Use `isNetworkFetchError` from `@terreno/rtk` to detect fetch failures.

## Realtime sockets

```tsx
import {useSocketConnection, getAuthToken} from "@terreno/rtk";

const {socket, isSocketConnected} = useSocketConnection({
  baseUrl: "ws://localhost:4000",
  shouldConnect: !!userId,
  getAuthToken: () => getAuthToken(),
});
```

Sockets auto-reconnect and refresh auth on token rotation.

## Feature flags

```tsx
import {useTerrenoFeatureFlags} from "@terreno/rtk";

useTerrenoFeatureFlags(terrenoApi, {
  skip: !userId,
  socket,
  userId,
});
```

Wrap children in `OpenFeatureProvider` (see `example-frontend/app/_layout.tsx`).

## Server status

```tsx
import {useServerStatus} from "@terreno/rtk";

const {isServerReachable} = useServerStatus();
```

Use to show degraded UI when the backend is unreachable.

## Realtime model updates

When `modelRouter` has `realtime` configured on the backend, list queries can invalidate on socket events. The example todo router uses `roomStrategy: "owner"` so users only receive their own updates.

After adding realtime to a backend model, regenerate the SDK and verify socket connection in the app.
