---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/api-health - Health check plugin for @terreno/api"
globs: ["**/*"]
---

# @terreno/api-health

Health check plugin for @terreno/api that provides a simple health endpoint. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

````bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode (TypeScript watch)
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
bun run test             # Run tests
bun run test:ci          # Run tests in CI mode
````

## Architecture

### File Structure

````
src/
  healthApp.ts           # HealthApp class - TerrenoPlugin implementation
  healthApp.test.ts      # Health endpoint tests
  index.ts               # Package exports
````

### Key Concepts

The api-health package provides:
- **HealthApp class**: TerrenoPlugin that registers a health check endpoint
- **Simple health checks**: Default always-healthy response
- **Custom health logic**: Optional check function for database/service validation
- **Standard responses**: 200 for healthy, 503 for unhealthy

## Usage

### Basic Health Check

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
  path: "/api/health",  // Optional, default: "/health"
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

### Disabling Health Check

````typescript
const healthApp = new HealthApp({
  enabled: false,  // Disables the health endpoint
});
````

## Configuration Options

````typescript
interface HealthOptions {
  enabled?: boolean;    // Enable/disable health endpoint (default: true)
  path?: string;        // Health endpoint path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;  // Custom check function
}

interface HealthCheckResult {
  healthy: boolean;     // Whether the service is healthy
  details?: Record<string, any>;  // Optional additional details
}
````

## Response Format

### Healthy Response (200)

````json
{
  "healthy": true,
  "details": {
    "database": "connected"
  }
}
````

### Unhealthy Response (503)

````json
{
  "healthy": false,
  "details": {
    "database": "disconnected"
  }
}
````

## TerrenoPlugin Pattern

HealthApp is an example implementation of the TerrenoPlugin interface:

````typescript
import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

export class HealthApp implements TerrenoPlugin {
  register(app: express.Application): void {
    // Register routes, middleware, or other setup
  }
}
````

This pattern allows for modular, reusable functionality that can be registered with TerrenoApp.

## Common Use Cases

### Kubernetes Liveness/Readiness Probes

````yaml
livenessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 5

readinessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 3
````

### Database Connection Check

````typescript
const healthApp = new HealthApp({
  check: async () => {
    try {
      const pingResult = await mongoose.connection.db.admin().ping();
      const dbState = mongoose.connection.readyState; // 1 = connected
      return {
        healthy: dbState === 1,
        details: {
          database: dbState === 1 ? "connected" : "disconnected",
          ping: pingResult,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {error: error.message},
      };
    }
  },
});
````

### Multi-Service Health Check

````typescript
const healthApp = new HealthApp({
  check: async () => {
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkS3(),
    ]);
    
    const allHealthy = checks.every(
      (result) => result.status === "fulfilled" && result.value === true
    );
    
    return {
      healthy: allHealthy,
      details: {
        database: checks[0].status === "fulfilled" ? "ok" : "error",
        redis: checks[1].status === "fulfilled" ? "ok" : "error",
        s3: checks[2].status === "fulfilled" ? "ok" : "error",
      },
    };
  },
});
````

## Testing

````typescript
import {HealthApp} from "@terreno/api-health";
import {expect, describe, it} from "bun:test";
import express from "express";
import request from "supertest";

describe("HealthApp", () => {
  it("returns healthy by default", async () => {
    const app = express();
    const healthApp = new HealthApp();
    healthApp.register(app);
    
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.healthy).toBe(true);
  });
  
  it("returns custom health check result", async () => {
    const app = express();
    const healthApp = new HealthApp({
      check: async () => ({healthy: false, details: {reason: "test"}}),
    });
    healthApp.register(app);
    
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.healthy).toBe(false);
  });
});
````

## Conventions

- Use `HealthApp` to add health checks to @terreno/api applications
- Always provide meaningful details in custom health checks
- Use 200 for healthy, 503 for unhealthy (standard HTTP status codes)
- Use `logger.info/warn/error/debug` for permanent logs
- Testing: bun test with expect, supertest for HTTP requests
