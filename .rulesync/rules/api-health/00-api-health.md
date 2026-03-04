---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/api-health - Health check plugin for @terreno/api"
globs: ["**/*"]
---

# @terreno/api-health

Health check plugin for @terreno/api backends. Provides a TerrenoPlugin implementation for adding health check endpoints to Express applications. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode (TypeScript watch)
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### File Structure

```
src/
  index.ts               # Package exports (HealthApp, types)
  healthApp.ts           # HealthApp TerrenoPlugin implementation
  healthApp.test.ts      # Unit tests
```

## HealthApp Plugin

Implements `TerrenoPlugin` interface from @terreno/api to provide health check endpoints.

### Basic Usage

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();
```

Creates a `GET /health` endpoint returning:
```json
{"healthy": true}
```

### Custom Health Checks

```typescript
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";

const healthApp = new HealthApp({
  path: "/api/health",  // Custom path (default: "/health")
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
```

## Options

```typescript
interface HealthOptions {
  enabled?: boolean;     // Enable/disable endpoint (default: true)
  path?: string;         // Endpoint path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

interface HealthCheckResult {
  healthy: boolean;      // Health status
  details?: Record<string, any>;  // Additional metadata
}
```

## Response Behavior

- **Healthy**: Returns HTTP 200 with `{healthy: true, details?: {...}}`
- **Unhealthy**: Returns HTTP 503 with `{healthy: false, details?: {...}}`
- **Check throws**: Returns HTTP 503 with `{healthy: false, details: {error: "..."}}`

## Integration Patterns

### With setupServer (Legacy)

```typescript
import {setupServer} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const healthApp = new HealthApp();

setupServer({
  userModel: User,
  addRoutes: (router) => {
    healthApp.register(router as any);
  },
});
```

### With TerrenoApp (Recommended)

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .register(modelRouter("/todos", Todo, {...}))
  .start();
```

## Use Cases

1. **Container orchestration**: Kubernetes liveness/readiness probes
2. **Load balancers**: Health check endpoints for traffic routing
3. **Monitoring**: Uptime and availability tracking
4. **Database checks**: Verify MongoDB connection
5. **Service dependencies**: Check external API availability

## Conventions

- Uses TerrenoPlugin interface for clean extensibility
- No authentication required on health endpoints (public by default)
- Custom checks should be async-safe and fast (avoid long-running operations)
- Return 503 (Service Unavailable) for unhealthy state, not 500
- Use `details` field for debugging info, not error stack traces

## Testing

- Framework: bun test with expect
- HTTP testing: supertest
- Mock database connections for health check tests
- Test both healthy and unhealthy states
- Verify correct HTTP status codes (200 vs 503)

### Example Test Pattern

```typescript
import {describe, expect, it} from "bun:test";
import express from "express";
import request from "supertest";
import {HealthApp} from "./healthApp";

describe("HealthApp", () => {
  it("returns healthy by default", async () => {
    const app = express();
    const healthApp = new HealthApp();
    healthApp.register(app);
    
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({healthy: true});
  });
  
  it("returns unhealthy when check fails", async () => {
    const app = express();
    const healthApp = new HealthApp({
      check: async () => ({healthy: false, details: {reason: "test"}}),
    });
    healthApp.register(app);
    
    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
    expect(response.body.healthy).toBe(false);
  });
});
```

## Example: Complete Health Check

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";

const healthApp = new HealthApp({
  check: async () => {
    const checks: Record<string, string> = {};
    let healthy = true;
    
    // Database check
    try {
      await mongoose.connection.db.admin().ping();
      checks.database = "connected";
    } catch (error) {
      checks.database = "disconnected";
      healthy = false;
    }
    
    // Memory check
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    checks.memoryMB = used.toFixed(2);
    if (used > 500) {
      healthy = false;
    }
    
    return {healthy, details: checks};
  },
});

const app = new TerrenoApp({userModel: User})
  .register(healthApp)
  .start();
```
