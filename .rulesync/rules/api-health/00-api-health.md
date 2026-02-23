---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/api-health - Health check plugin for @terreno/api"
globs: ["**/*"]
---

# @terreno/api-health

Health check plugin for @terreno/api backends. Provides a simple, extensible TerrenoPlugin for adding health check endpoints to your API. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

``````bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
``````

## Architecture

### File Structure

``````
src/
  index.ts               # Package exports
  healthApp.ts           # HealthApp TerrenoPlugin implementation
  healthApp.test.ts      # Tests
``````

## Key Exports

``````typescript
import {
  HealthApp,             // TerrenoPlugin for health checks
  HealthCheckResult,     // Result interface
  HealthOptions,         // Configuration options
} from "@terreno/api-health";
``````

## HealthApp

TerrenoPlugin that provides a health check endpoint. Supports custom health check logic for monitoring database connections, external services, or any other health indicators.

### Basic Usage

``````typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

// Simple health check (always healthy)
const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();

// GET /health → {healthy: true}
``````

### Custom Health Check

``````typescript
import mongoose from "mongoose";
import {HealthApp} from "@terreno/api-health";

const healthApp = new HealthApp({
  path: "/api/health",  // Custom path (default: "/health")
  check: async () => {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        healthy: true,
        details: {
          database: "connected",
          uptime: process.uptime(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          database: "disconnected",
          error: (error as Error).message,
        },
      };
    }
  },
});

const app = new TerrenoApp({userModel: User})
  .register(healthApp)
  .start();
``````

### Configuration Options

``````typescript
interface HealthOptions {
  /** Whether the health endpoint is enabled (default: true) */
  enabled?: boolean;
  /** Path for the health endpoint (default: "/health") */
  path?: string;
  /** Optional custom health check function */
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

interface HealthCheckResult {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Optional additional details about the health status */
  details?: Record<string, any>;
}
``````

### Response Behavior

- **200**: Service is healthy (`{healthy: true}`)
- **503**: Service is unhealthy (`{healthy: false}`)
- **Error handling**: If check function throws, returns 503 with error in details

### Disable Health Check

``````typescript
const app = new TerrenoApp({userModel: User})
  .register(new HealthApp({enabled: false}))
  .start();

// No /health endpoint registered
``````

## Integration with TerrenoApp

HealthApp implements the `TerrenoPlugin` interface from @terreno/api:

``````typescript
export interface TerrenoPlugin {
  register(app: express.Application): void;
}
``````

When registered with TerrenoApp, it adds a GET endpoint at the configured path. The endpoint:
- Runs the custom check function if provided
- Returns appropriate status codes (200 for healthy, 503 for unhealthy)
- Handles both sync and async check functions
- Catches and reports errors from the check function

## Common Use Cases

### Database Health Check

``````typescript
new HealthApp({
  check: async () => {
    const connected = mongoose.connection.readyState === 1;
    return {
      healthy: connected,
      details: {database: connected ? "connected" : "disconnected"},
    };
  },
})
``````

### Multiple Services Check

``````typescript
new HealthApp({
  check: async () => {
    const [dbOk, redisOk] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);
    return {
      healthy: dbOk && redisOk,
      details: {database: dbOk, redis: redisOk},
    };
  },
})
``````

### Kubernetes Liveness Probe

``````typescript
// Basic liveness check at /health
new HealthApp()

// Readiness check at /ready with DB validation
new HealthApp({
  path: "/ready",
  check: async () => {
    const dbReady = mongoose.connection.readyState === 1;
    return {healthy: dbReady, details: {database: dbReady}};
  },
})
``````

## Testing

``````typescript
import {describe, expect, it} from "bun:test";
import express from "express";
import supertest from "supertest";
import {HealthApp} from "@terreno/api-health";

describe("HealthApp", () => {
  it("returns healthy by default", async () => {
    const app = express();
    new HealthApp().register(app);
    const res = await supertest(app).get("/health").expect(200);
    expect(res.body).toEqual({healthy: true});
  });

  it("handles custom check function", async () => {
    const app = express();
    new HealthApp({
      check: () => ({healthy: true, details: {db: "connected"}}),
    }).register(app);
    const res = await supertest(app).get("/health").expect(200);
    expect(res.body.details.db).toBe("connected");
  });
});
``````

## Conventions

- Use `HealthApp` to add health endpoints to TerrenoApp
- Provide custom check functions for production monitoring
- Return detailed health status in the `details` object
- Use async check functions for I/O operations (database, network)
- Return `healthy: false` for degraded states that should fail health checks
- Use `logger.info/warn/error/debug` for permanent logs
- Testing: bun test with expect, supertest for HTTP requests
