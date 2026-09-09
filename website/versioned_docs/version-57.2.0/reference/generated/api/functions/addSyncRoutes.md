> **addSyncRoutes**(`app`, `options?`): `void`

Mount the SyncDB HTTP routes:
- GET /sync/streams — the authoritative set of streams the caller belongs to (C2)
- GET /sync/snapshot — per-stream bootstrap/catch-up with server-enforced scoping
- POST /sync/mutate — HTTP fallback mutation channel over applySyncMutation
- GET /sync/key — per-user key material for the default encryption KeyProvider

## Parameters

### app

`Application`

### options?

[`SyncAppOptions`](../interfaces/SyncAppOptions.md) = `{}`

## Returns

`void`
