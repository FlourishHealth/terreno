---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/api-health - Health check plugin for @terreno/api"
globs: ["**/*"]
---

# @terreno/api-health

Health check plugin for @terreno/api backends. Provides a simple, extensible TerrenoPlugin for adding health check endpoints to Express applications. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

````bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
````

## Architecture

### File Structure

````
src/
  index.ts               # Package exports
  healthApp.ts           # HealthApp class (TerrenoPlugin implementation)
  healthApp.test.ts      # Tests for HealthApp
````

## HealthApp

TerrenoPlugin that provides a health check endpoint with optional custom health check logic.

### Basic Usage

````typescript
import {HealthApp} from "@terreno/api-health";
import {TerrenoApp} from "@terreno/api";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();

// Creates GET /health endpoint that returns {healthy: true}
````

### Custom Health Check

````typescript
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
````

## Configuration Options

````typescript
interface HealthOptions {
  enabled?: boolean;      // Enable/disable endpoint (default: true)
  path?: string;          // Endpoint path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

interface HealthCheckResult {
  healthy: boolean;       // Health status
  details?: Record<string, any>;  // Optional details
}
````

## Response Format

**Healthy (200):**
````json
{
  "healthy": true,
  "details": {
    "database": "connected",
    "cache": "available"
  }
}
````

**Unhealthy (503):**
````json
{
  "healthy": false,
  "details": {
    "database": "disconnected",
    "error": "Connection timeout"
  }
}
````

## Integration with TerrenoApp

HealthApp implements the TerrenoPlugin interface, making it compatible with the TerrenoApp register pattern:

````typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp({
    path: "/health",
    check: async () => {
      // Custom health checks
      const dbOk = await checkDatabase();
      const redisOk = await checkRedis();
      return {
        healthy: dbOk && redisOk,
        details: {database: dbOk, redis: redisOk},
      };
    },
  }))
  .start();
````

## Use Cases

- **Kubernetes/Docker health probes**: Simple endpoint for liveness/readiness checks
- **Load balancer health checks**: Monitor application availability
- **Monitoring systems**: Automated health status collection
- **Dependency validation**: Check database, cache, or external service connections

## Conventions

- Returns 200 for healthy, 503 for unhealthy
- Always returns JSON response with `healthy` boolean
- Custom checks should never throw — wrap in try/catch and return `{healthy: false}`
- Use `details` object for diagnostic information
- Health endpoint should be fast (< 100ms) — avoid expensive checks
- Use TypeScript with ES modules
- Prefer const arrow functions
- Use `logger.info/warn/error/debug` for permanent logs (if using @terreno/api logging)

## Testing

- Framework: bun test with expect
- HTTP testing: supertest
- Test both healthy and unhealthy states
- Test custom check function integration
- Verify HTTP status codes (200, 503)
- Never mock @terreno/api or express — test against real functionality

### Test Pattern

````typescript
import {describe, expect, it} from "bun:test";
import express from "express";
import request from "supertest";
import {HealthApp} from "./healthApp";

describe("HealthApp", () => {
  it("returns healthy by default", async () => {
    const app = express();
    new HealthApp().register(app);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({healthy: true});
  });

  it("supports custom health checks", async () => {
    const app = express();
    new HealthApp({
      check: async () => ({healthy: false, details: {error: "test"}}),
    }).register(app);
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.healthy).toBe(false);
  });
});
````

## Related Packages

- **@terreno/api**: TerrenoPlugin interface and TerrenoApp class
- **express**: HTTP server framework
