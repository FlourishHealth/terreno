# Realtime — Terreno

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

`modelRouter` `realtime` (RTK cache-patching via `realtimeList` / `realtimeDocument`) is **deprecated** and **will be removed in Terreno 58**. Use `sync` on `modelRouter` with `@terreno/syncdb`. `RealtimeApp` stays as the socket host.

Do not add new `realtimeList` / `realtimeDocument` wiring. After adding `sync` to a backend model, use syncdb hooks on the client.
