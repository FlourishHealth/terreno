---
paths:
  - '**/*'
---
# @terreno/api-health

Health check plugin for @terreno/api backends. Provides a simple, extensible health check endpoint with support for custom health checks. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### File Structure

```
src/
  index.ts               # Package exports
  healthApp.ts           # HealthApp plugin implementation
  healthApp.test.ts      # Tests
```

## Usage

### Basic Health Check

Simple health check that always returns healthy:

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();

// GET /health => {"healthy": true}
```

### Custom Health Check

Health check with custom logic (e.g., database connection test):

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";

const healthApp = new HealthApp({
  path: "/api/health",
  check: async () => {
    try {
      await mongoose.connection.db.admin().ping();
      return {healthy: true, details: {database: "connected"}};
    } catch (error) {
      return {healthy: false, details: {database: "disconnected"}};
    }
  },
});

const app = new TerrenoApp({userModel: User})
  .register(healthApp)
  .start();

// GET /api/health => {"healthy": true, "details": {"database": "connected"}}
```

### Configuration Options

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

- **200 OK**: Service is healthy (`healthy: true`)
- **503 Service Unavailable**: Service is unhealthy (`healthy: false`) or check threw error
- Response format: `{healthy: boolean, details?: object}`

## TerrenoPlugin Interface

`HealthApp` implements the `TerrenoPlugin` interface from `@terreno/api`:

```typescript
import type {TerrenoPlugin} from "@terreno/api";

export class HealthApp implements TerrenoPlugin {
  register(app: express.Application): void {
    // Registers health check endpoint
  }
}
```

Any class implementing `TerrenoPlugin` can be registered with `TerrenoApp.register()`.

## Example Use Cases

### Database Health

```typescript
const healthApp = new HealthApp({
  check: async () => {
    const isConnected = mongoose.connection.readyState === 1;
    return {
      healthy: isConnected,
      details: {database: isConnected ? "connected" : "disconnected"},
    };
  },
});
```

### Multi-Service Health

```typescript
const healthApp = new HealthApp({
  check: async () => {
    const [dbHealthy, redisHealthy] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);
    return {
      healthy: dbHealthy && redisHealthy,
      details: {database: dbHealthy, redis: redisHealthy},
    };
  },
});
```

### Conditional Checks

```typescript
const healthApp = new HealthApp({
  check: async () => {
    if (process.env.NODE_ENV === "production") {
      return await detailedHealthCheck();
    }
    return {healthy: true};  // Simple check in dev
  },
});
```

## Conventions

- Use `TerrenoApp.register()` to add the plugin
- Health check function should be async-safe (handle errors)
- Return `healthy: false` for degraded states, not just errors
- Use `details` for diagnostic info (database status, queue depth, etc.)
- Keep health checks lightweight (< 1s response time)
- Use `logger.error/warn` for health check failures

## Testing

```typescript
import {describe, expect, it} from "bun:test";
import request from "supertest";
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

describe("HealthApp", () => {
  it("returns healthy status", async () => {
    const app = new TerrenoApp({userModel: User})
      .register(new HealthApp())
      .build();
    
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.healthy).toBe(true);
  });
});
```
