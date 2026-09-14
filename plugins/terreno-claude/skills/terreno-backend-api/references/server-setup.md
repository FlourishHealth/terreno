# Server Setup — Terreno

## TerrenoApp (recommended)

```typescript
import {TerrenoApp} from "@terreno/api";
import {User} from "./models/user";
import {todoRouter} from "./api/todos";

const app = new TerrenoApp({
  userModel: User,
  loggingOptions: {logRequests: true, logSlowRequests: true},
})
  .register(todoRouter)
  .start();
```

Methods: `.register()`, `.addMiddleware()`, `.build()`, `.start()`.

## setupServer (legacy)

```typescript
import {setupServer} from "@terreno/api";

setupServer({
  userModel: User,
  addRoutes: (router, options) => {
    router.use("/todos", modelRouter(Todo, {...options, ...}));
  },
});
```

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection (replica set for change streams) |
| `TOKEN_SECRET` | JWT signing secret |
| `TOKEN_ISSUER` | JWT issuer claim |
| `REFRESH_TOKEN_SECRET` | Refresh token secret |
| `SESSION_SECRET` | Express session secret |
| `PORT` | Server port (default 4000) |

Optional: `ENABLE_SWAGGER=true`, `USE_SENTRY_LOGGING=true`, GitHub OAuth vars, Better Auth vars.

## MongoDB for local dev

The dev server needs a real replica set (change streams). See `AGENTS.md` for the single-node replica set setup with `mongodb-memory-server` cache binary.

```bash
MONGO_URI="mongodb://127.0.0.1:27017/terreno-example?replicaSet=rs0" \
  TOKEN_SECRET=dev-token-secret TOKEN_ISSUER=terreno-dev \
  REFRESH_TOKEN_SECRET=dev-refresh-secret SESSION_SECRET=dev-session-secret \
  PORT=4000 bun run backend:dev
```

Seed users: `cd example-backend && bun run seed` → `test@example.com` / `testpassword123`.

## Health check

```bash
curl localhost:4000/health
# {"healthy":true,...}
```

## OpenAPI / Swagger

- Spec: `http://localhost:4000/openapi.json`
- Swagger UI: `http://localhost:4000/swagger` (when `ENABLE_SWAGGER=true`)

## Logging

```typescript
import {createScopedLogger, logger} from "@terreno/api";

logger.info("Server started", {port: 4000});

const log = createScopedLogger({
  prefix: "[Billing]",
  labels: {invoiceId: id.toString()},
});
log.info("Processing payment");
```

Never use `console.log` for permanent server logs.

## Testing

```typescript
import {describe, it, expect} from "bun:test";
import request from "supertest";
import {getBaseServer, authAsUser, setupDb} from "@terreno/api/tests";

describe("todos", () => {
  it("lists todos for authenticated user", async () => {
    const app = await getBaseServer();
    const agent = await authAsUser(app, "notAdmin");
    const res = await agent.get("/todos");
    expect(res.status).toBe(200);
  });
});
```

See `backend-test-env` skill when tests mutate `process.env`.

## Plugins

Register `TerrenoPlugin` implementations:

```typescript
import {BetterAuthApp, type BetterAuthConfig} from "@terreno/api";
import {AdminApp} from "@terreno/admin-backend";

app.register(new BetterAuthApp({config: betterAuthConfig, userModel: User}));
admin.register(app);
```
