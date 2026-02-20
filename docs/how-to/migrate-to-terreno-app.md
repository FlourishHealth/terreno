# Migrate from setupServer to TerrenoApp

**Status**: 🚧 Coming in v2.0.0

This guide will help you migrate from the current `setupServer()` function to the new `TerrenoApp` class when it becomes available.

## Overview

The new `TerrenoApp` class provides a fluent builder API that's more flexible and easier to configure than `setupServer()`. This is a **breaking change** — `setupServer` will be deprecated in v2.0.0 and removed in a future version.

## Why the change?

- **Configuration over environment variables**: Pass all settings via options instead of relying on env vars
- **Toggleable middleware**: Enable/disable every built-in middleware piece
- **Cleaner API**: Fluent builder pattern vs. large options object
- **Better extensibility**: Add custom middleware, routes, and hooks at precise points in the lifecycle
- **Modular architecture**: Foundation for installable "apps" (admin panel, health checks, etc.)

## Before: setupServer

``````typescript
import {setupServer} from "@terreno/api";

setupServer({
  userModel: User,
  addRoutes: (router, options) => {
    router.use("/todos", modelRouter(Todo, {
      ...options,
      permissions: { /* ... */ },
    }));
  },
  authOptions: {
    generateJWTPayload: (user) => ({sub: user._id}),
  },
  corsOrigin: true,
});
``````

## After: TerrenoApp

``````typescript
import {TerrenoApp} from "@terreno/api";

const app = TerrenoApp.create({
  auth: {
    userModel: User,
    token: {
      issuer: process.env.TOKEN_ISSUER!,
      secret: process.env.TOKEN_SECRET!,
    },
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_SECRET!,
    },
    session: {
      secret: process.env.SESSION_SECRET!,
    },
    generateToken: (user) => ({sub: user._id}),
  },
  middleware: {
    cors: {enabled: true, origin: true},
  },
})
  .addModelRouter("/todos", Todo, {
    permissions: { /* ... */ },
  })
  .start();
``````

## Migration checklist

This section will be expanded when TerrenoApp is implemented. Key areas to migrate:

- [ ] Replace `setupServer()` call with `TerrenoApp.create()`
- [ ] Move environment variables into configuration object
- [ ] Convert `addRoutes` callback to `.addModelRouter()` and `.addRoute()` calls
- [ ] Update auth configuration structure
- [ ] Review and configure middleware options
- [ ] Test all endpoints still work
- [ ] Update tests to use `app.build()` instead of `setupServer({skipListen: true})`

## Breaking changes

**Environment variables**: No longer automatically read. Pass all configuration via options:

| Old (env var) | New (option) |
|---------------|--------------|
| `TOKEN_SECRET` | `auth.token.secret` |
| `TOKEN_ISSUER` | `auth.token.issuer` |
| `TOKEN_EXPIRES_IN` | `auth.token.expiresIn` |
| `REFRESH_TOKEN_SECRET` | `auth.refreshToken.secret` |
| `SESSION_SECRET` | `auth.session.secret` |

**Auth options**: Renamed and restructured:

- `authOptions.generateJWTPayload` → `auth.generateToken`
- Auth routes and me routes are now toggleable via `auth.enableAuthRoutes` and `auth.enableMeRoute`

**Routes**: Instead of a single `addRoutes` callback, use fluent methods:

``````typescript
// Old
addRoutes: (router, options) => {
  router.use("/todos", modelRouter(Todo, {...options, ...}));
  router.use("/posts", modelRouter(Post, {...options, ...}));
}

// New
.addModelRouter("/todos", Todo, { /* ... */ })
.addModelRouter("/posts", Post, { /* ... */ })
``````

**ModelRouter shorthand**: Pass permissions directly without wrapping in options:

``````typescript
// Old
.addModelRouter("/todos", Todo, {
  permissions: {list: [IsAuthenticated]},
  sort: "-created",
})

// New - still supported
.addModelRouter("/todos", Todo, {
  permissions: {list: [IsAuthenticated]},
  sort: "-created",
})

// New - shorthand when only permissions needed
.addModelRouter("/todos", Todo, {list: [IsAuthenticated]})
``````

## Need help?

- 📖 [Implementation plan](../implementationPlans/ModularAPI.md) — Full technical specification
- 💬 [GitHub Discussion #149](https://github.com/FlourishHealth/terreno/pull/149) — Ask questions and provide feedback
- 🐛 [Report migration issues](https://github.com/FlourishHealth/terreno/issues/new)

## Timeline

- **v1.x**: Current stable version with `setupServer`
- **v2.0.0-beta**: TerrenoApp available, `setupServer` marked `@deprecated`
- **v2.0.0**: `setupServer` deprecated but still functional
- **v3.0.0**: `setupServer` removed entirely

This guide will be updated with concrete examples and edge cases as TerrenoApp is implemented.
