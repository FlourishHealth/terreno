# Rate limiting

Turn on HTTP rate limiting for `@terreno/api` by passing `rateLimit` on `TerrenoApp`. The framework does **not** read `RATE_LIMIT_ENABLED`.

Terreno 58 will default the limiter **on**. Until then, omit `rateLimit` to leave it off.

## Enable (memory)

```typescript
new TerrenoApp({
  userModel: User,
  rateLimit: process.env.RATE_LIMIT_ENABLED === "true" ? {store: "memory"} : undefined,
});
```

Empty `{}` is the same as `{store: "memory"}`.

## Redis on Cloud Run

1. Add a Valkey or Redis instance (Memorystore or equivalent).
2. Set `VALKEY_URL` (preferred) or `REDIS_URL` on the Cloud Run service. Same URL as realtime Redis.
3. Pass `store: "redis"` only when you intend to enable the limiter:

```typescript
new TerrenoApp({
  userModel: User,
  rateLimit:
    process.env.RATE_LIMIT_ENABLED === "true"
      ? {store: "redis"}
      : undefined,
});
```

4. Install `ioredis` in the app that runs `@terreno/api` if it is not already a dependency.
5. Missing `VALKEY_URL` / `REDIS_URL` fails **startup** when `store: "redis"` (clear `APIError`).

## Stores

| `store` | When to use | Config |
| --- | --- | --- |
| `memory` (default) | Single process | none |
| `redis` | Shared bucket across replicas | `VALKEY_URL` then `REDIS_URL` |
| `mongo` | Shared bucket without Redis | Open mongoose connection; collection `rateLimitHits` with TTL on `expiresAt` |

## Mongo

Pass `{store: "mongo"}`. Hits live in `rateLimitHits` on the same mongoose connection as the app. A TTL index on `expiresAt` expires windows. This collection is not a `modelRouter` resource.

Unauthenticated keys use `req.ip`. When the limiter is on, Express `trust proxy` defaults to `1` unless you set `rateLimit.trustProxy`.


