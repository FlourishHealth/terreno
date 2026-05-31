# Offline Mode Verification Guide

Manual verification for offline create/update/delete, replay, auth-blocked sync, spotty detection, and conflict resolution using the example apps.

## Setup

```bash
# Terminal 1
bun run backend:dev

# Terminal 2
bun run frontend:web
```

Log in to the example app and open the Todos tab.

## Offline create / update / delete

1. Open browser devtools → Network → set **Offline**.
2. Confirm the offline banner appears.
3. Create a todo, toggle completion, and delete a todo.
4. Confirm optimistic UI updates happen immediately.
5. Restore network connectivity.
6. Confirm the syncing banner appears briefly, then clears after replay.
7. Refresh the page and confirm server state matches local actions.

## Queue persistence

1. Go offline and queue at least one mutation.
2. Reload the page while still offline.
3. Confirm pending count remains in the banner.
4. Go online and confirm replay succeeds.

## Spotty connection

1. Throttle network in devtools (e.g. Slow 3G) or temporarily stop the backend while keeping browser online.
2. Confirm the banner switches to **Connection is unstable** when health checks report spotty quality.
3. Restore normal connectivity and confirm the banner clears.

## Auth-blocked replay

1. Queue mutations while offline.
2. Block `/auth/refresh_token` in devtools or stop the backend before going online.
3. Go online with an access token near expiry (or wait for refresh attempt during replay).
4. Confirm **Sync paused until you reconnect** appears without clearing todos or the queue.
5. Restore auth/network and confirm replay resumes.

## Conflict resolution

1. Create a todo online and note its title.
2. Go offline and change the todo (e.g. toggle completed).
3. In another session or via API, update the same todo on the server.
4. Go online and wait for a conflict card.
5. Choose **Use server** and confirm the server version appears in the list.
6. Repeat with **Keep mine** and confirm your local change is replayed.

## Cleanup

1. Clear queued state by syncing or logging out (logout clears the offline queue).
2. Remove devtools network overrides.

## Notes

- Do not edit `example-frontend/store/openApiSdk.ts` manually; regenerate with `cd example-frontend && bun run sdk` only when the backend OpenAPI surface changes.
- Playwright coverage lives in `example-frontend/e2e/offline.spec.ts`.
