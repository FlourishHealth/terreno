# Migration Guide: setupServer to TerrenoApp

You are helping a user migrate their Express backend from the legacy `setupServer` function to the new `TerrenoApp` builder API in `@terreno/api`.

## Overview

`setupServer` is being replaced by `TerrenoApp`, a fluent builder API that provides:
- Explicit configuration (no environment variables)
- Plugin system via `TerrenoPlugin` interface
- Lifecycle hooks at every initialization stage
- Fluent `.addModelRouter()`, `.addRoute()`, `.addMiddleware()` methods
- Built-in graceful shutdown

## Step-by-Step Migration

### 1. Replace setupServer with TerrenoApp.create

**Before:**
```typescript
import {setupServer, setupEnvironment} from "@terreno/api";

setupEnvironment(); // validates env vars

const app = setupServer({
  userModel: User,
  addRoutes,
  addMiddleware,
  skipListen,
  corsOrigin: "*",
  loggingOptions: { ... },
  authOptions: { ... },
});
```

**After:**
```typescript
import {TerrenoApp} from "@terreno/api";

const terrenoApp = TerrenoApp.create({
  auth: {
    userModel: User,
    token: {
      issuer: process.env.TOKEN_ISSUER!,
      secret: process.env.TOKEN_SECRET!,
      expiresIn: process.env.TOKEN_EXPIRES_IN ?? "1h",
    },
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_SECRET!,
    },
    session: {
      secret: process.env.SESSION_SECRET!,
    },
  },
  server: {
    port: Number(process.env.PORT) || 9000,
    skipListen,
  },
  middleware: {
    cors: {
      origin: "*",
    },
  },
  logging: {
    requests: {
      enabled: true,
    },
  },
});

await terrenoApp.start();
```

### 2. Move addRoutes to fluent .addModelRouter() and .addRoute() calls

**Before:**
```typescript
const addRoutes: AddRoutes = (router, options) => {
  router.use("/todos", modelRouter(Todo, {
    ...options,
    permissions: { ... },
    queryFields: ["completed", "ownerId"],
    sort: "-created",
  }));
  router.use("/custom", customRouter);
};
```

**After:**
```typescript
TerrenoApp.create({ ... })
  .addModelRouter("/todos", Todo, {
    permissions: {
      create: [Permissions.IsAuthenticated],
      read: [Permissions.IsOwner],
      update: [Permissions.IsOwner],
      delete: [Permissions.IsOwner],
      list: [Permissions.IsAuthenticated],
    },
    queryFields: ["completed", "ownerId"],
    sort: "-created",
  })
  .addRoute("/custom", customRouter)
  .start();
```

### 3. Move addMiddleware to fluent .addMiddleware() calls

**Before:**
```typescript
const addMiddleware: AddRoutes = (router) => {
  router.use(myCustomMiddleware);
};
```

**After:**
```typescript
TerrenoApp.create({ ... })
  .addMiddleware(myCustomMiddleware)
  .start();
```

### 4. Replace health options with HealthApp plugin

The health endpoint is now a separate package `@terreno/api-health` that uses the `TerrenoPlugin` interface.

**Install:**
Add `@terreno/api-health` to your package.json dependencies.

**Before (if using inline health):**
```typescript
const app = setupServer({ ... });
// No built-in health in setupServer
```

**After:**
```typescript
import {HealthApp} from "@terreno/api-health";

TerrenoApp.create({ ... })
  .use(new HealthApp({
    check: async () => {
      const dbConnected = mongoose.connection.readyState === 1;
      return {
        healthy: dbConnected,
        details: {
          database: dbConnected ? "connected" : "disconnected",
          uptime: process.uptime(),
        },
      };
    },
  }))
  .start();
```

**Or standalone (without TerrenoApp):**
```typescript
import {HealthApp} from "@terreno/api-health";

const app = setupServer({ ... });
new HealthApp({ check: async () => ({ healthy: true }) }).register(app);
```

### 5. Replace environment variable checks with explicit config

**Before (implicit env vars):**
```
TOKEN_ISSUER=my-app
TOKEN_SECRET=secret123
REFRESH_TOKEN_SECRET=refresh123
SESSION_SECRET=session123
TOKEN_EXPIRES_IN=1h
```

**After (explicit in code):**
```typescript
TerrenoApp.create({
  auth: {
    userModel: User,
    token: {
      issuer: "my-app",
      secret: process.env.TOKEN_SECRET!,
      expiresIn: "1h",
    },
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_SECRET!,
    },
    session: {
      secret: process.env.SESSION_SECRET!,
    },
  },
});
```

### 6. Use hooks for lifecycle customization

**Before (scattered setup):**
```typescript
const app = setupServer({ ... });
// Manual setup after server creation
app.use("/admin", adminMiddleware);
```

**After (structured hooks):**
```typescript
TerrenoApp.create({
  hooks: {
    onAuthReady: (app) => {
      app.use("/admin", adminMiddleware);
    },
    onListening: (server, port) => {
      logger.info(`Server listening on port ${port}`);
    },
    onError: (error, req) => {
      errorTracker.capture(error, { url: req.url });
    },
  },
});
```

### 7. Add graceful shutdown

**Before (manual or none):**
```typescript
process.on("SIGTERM", () => {
  mongoose.disconnect();
  process.exit(0);
});
```

**After:**
```typescript
TerrenoApp.create({
  shutdown: {
    handleSignals: true,
    timeout: 30000,
    onShutdown: async () => {
      await mongoose.disconnect();
    },
  },
});
```

## Plugin System

The `TerrenoPlugin` interface allows modular composition:

```typescript
import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

export class MyPlugin implements TerrenoPlugin {
  register(app: express.Application): void {
    // Register routes, middleware, etc.
    app.get("/my-endpoint", (req, res) => {
      res.json({ok: true});
    });
  }
}
```

Available plugins:
- `@terreno/api-health` - Health check endpoint (`HealthApp`)

## Key Differences

| Feature | setupServer | TerrenoApp |
|---------|------------|------------|
| Configuration | env vars + options | Explicit options only |
| Routes | `addRoutes` callback | Fluent `.addModelRouter()` / `.addRoute()` |
| Middleware | `addMiddleware` callback | Fluent `.addMiddleware()` |
| Health | None built-in | Plugin: `@terreno/api-health` |
| Hooks | None | Full lifecycle hooks |
| Shutdown | Manual | Built-in graceful shutdown |
| Plugins | None | `TerrenoPlugin` interface |

## Migration Checklist

When migrating a file, verify:

- [ ] `setupServer` replaced with `TerrenoApp.create().start()`
- [ ] `setupEnvironment()` call removed (no longer needed)
- [ ] Auth tokens configured explicitly in `auth` option
- [ ] `addRoutes` callback replaced with `.addModelRouter()` / `.addRoute()` calls
- [ ] `addMiddleware` callback replaced with `.addMiddleware()` calls
- [ ] CORS configured in `middleware.cors` option
- [ ] Logging configured in `logging` option
- [ ] Health endpoint added via `@terreno/api-health` if needed
- [ ] Graceful shutdown configured in `shutdown` option
- [ ] `skipListen` moved to `server.skipListen`
- [ ] Tests updated to use `TerrenoApp.create({ server: { skipListen: true } }).build()`
