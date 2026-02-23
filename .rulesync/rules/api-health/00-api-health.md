---
description: '@terreno/api-health - Health check plugin for @terreno/api'
applyTo: '**/*'
---
# @terreno/api-health

Health check plugin for @terreno/api that provides a simple, extensible health check endpoint. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode (TypeScript watch)
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
bun run test             # Run tests
bun run test:ci          # Run tests (CI mode)
```

## Architecture

### File Structure

```
src/
  healthApp.ts           # HealthApp class - TerrenoPlugin implementation
  healthApp.test.ts      # Test suite
  index.ts               # Package exports
```

## Key Exports

```typescript
import {
  HealthApp,             // TerrenoPlugin for health check endpoint
  HealthOptions,         // Configuration options
  HealthCheckResult,     // Health check result type
} from "@terreno/api-health";
```

## Usage

### Simple Health Check

Always returns healthy status:

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();

// GET /health returns {healthy: true}
```

### Custom Health Check

With database connection test:

```typescript
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";

const healthApp = new HealthApp({
  path: "/api/health",
  check: async () => {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        healthy: true,
        details: {database: "connected"},
      };
    } catch (error) {
      return {
        healthy: false,
        details: {database: "disconnected", error: (error as Error).message},
      };
    }
  },
});

const app = new TerrenoApp({userModel: User})
  .register(healthApp)
  .start();
```

### Legacy setupServer Pattern

```typescript
import {setupServer} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const healthCheck = new HealthApp();

setupServer({
  userModel: User,
  addRoutes: (router) => {
    healthCheck.register(router as any);
  },
});
```

## HealthApp Options

```typescript
interface HealthOptions {
  enabled?: boolean;      // Enable/disable endpoint (default: true)
  path?: string;          // Endpoint path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;  // Custom check
}

interface HealthCheckResult {
  healthy: boolean;       // Health status
  details?: Record<string, any>;  // Additional details
}
```

## Response Behavior

- **200 OK**: Health check passed (`healthy: true`)
- **503 Service Unavailable**: Health check failed (`healthy: false`) or check function threw error
- Custom check errors are caught and returned as `{healthy: false, details: {error: message}}`

## TerrenoPlugin Implementation

HealthApp implements the `TerrenoPlugin` interface from @terreno/api:

```typescript
export class HealthApp implements TerrenoPlugin {
  constructor(options?: HealthOptions);
  register(app: express.Application): void;
}
```

This pattern allows:
- Clean registration with `TerrenoApp.register()`
- Conditional setup based on options
- Encapsulated route and middleware configuration
- Reusable plugin distribution

## Common Patterns

### Multi-Service Health Check

Check database, cache, and external services:

```typescript
const healthApp = new HealthApp({
  check: async () => {
    const results = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkExternalAPI(),
    ]);

    const [db, cache, api] = results;
    const healthy = results.every(r => r.status === "fulfilled" && r.value);

    return {
      healthy,
      details: {
        database: db.status === "fulfilled" ? "ok" : "error",
        cache: cache.status === "fulfilled" ? "ok" : "error",
        api: api.status === "fulfilled" ? "ok" : "error",
      },
    };
  },
});
```

### Kubernetes Liveness/Readiness

Use different paths for liveness and readiness probes:

```typescript
const liveness = new HealthApp({path: "/health/live"});
const readiness = new HealthApp({
  path: "/health/ready",
  check: async () => {
    const dbReady = await checkDatabaseReady();
    return {healthy: dbReady, details: {database: dbReady ? "ready" : "not ready"}};
  },
});

const app = new TerrenoApp({userModel: User})
  .register(liveness)
  .register(readiness)
  .start();
```

### Disable in Development

```typescript
const healthApp = new HealthApp({
  enabled: process.env.NODE_ENV === "production",
});
```

## Conventions

- Use TypeScript with ES modules
- Prefer const arrow functions
- Use `logger.info/warn/error/debug` for permanent logs
- Testing: bun test with expect, supertest for HTTP
- Never mock @terreno/api — test against real Express app
- Health check functions should be fast (< 1s timeout recommended)
- Return detailed error information in `details` field for debugging
