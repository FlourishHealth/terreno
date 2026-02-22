---
description: '@terreno/api-health - Health check plugin for @terreno/api'
applyTo: '**/*'
---
# @terreno/api-health

Health check plugin for @terreno/api that provides configurable health check endpoints for Express applications. This is a **backend-only** package — no React, no UI components, no frontend code.

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
  index.ts               # Package exports
  healthApp.ts           # HealthApp class - implements TerrenoPlugin interface
  healthApp.test.ts      # Test suite
```

### Key Concepts

The health check plugin provides:
- **HealthApp class**: Implements the `TerrenoPlugin` interface from @terreno/api
- **Configurable endpoint**: Customize path and health check logic
- **Status codes**: Returns 200 for healthy, 503 for unhealthy
- **Custom checks**: Optional health check function for database, cache, or other service validation
- **Error handling**: Catches errors from custom check functions and returns 503

## Usage

### Basic Health Check

```typescript
import {HealthApp} from "@terreno/api-health";
import {setupServer} from "@terreno/api";

setupServer({
  userModel: User,
  plugins: [new HealthApp()],
});

// Creates GET /health endpoint that returns {healthy: true}
```

### Custom Path

```typescript
const health = new HealthApp({
  path: "/status",  // Default is "/health"
});

// Creates GET /status endpoint
```

### Custom Health Check

```typescript
const health = new HealthApp({
  check: async () => {
    // Check database connection
    const dbHealthy = await mongoose.connection.db.admin().ping();
    
    // Check Redis/cache
    const cacheHealthy = await redis.ping();
    
    return {
      healthy: dbHealthy && cacheHealthy,
      details: {
        database: dbHealthy ? "connected" : "disconnected",
        cache: cacheHealthy ? "connected" : "disconnected",
      },
    };
  },
});

// Returns 200 if healthy, 503 if unhealthy
```

### Disable Health Check

```typescript
const health = new HealthApp({
  enabled: false,  // Does not register the health endpoint
});
```

## HealthApp Options

```typescript
interface HealthOptions {
  enabled?: boolean;     // Enable/disable health endpoint (default: true)
  path?: string;         // Health check path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;  // Custom health check
}

interface HealthCheckResult {
  healthy: boolean;      // Health status
  details?: Record<string, any>;  // Optional details (database status, version, etc.)
}
```

## Integration with setupServer

The HealthApp implements the `TerrenoPlugin` interface, which requires a `register(app: express.Application)` method. This allows it to be used with @terreno/api's plugin system:

```typescript
import {HealthApp} from "@terreno/api-health";
import {setupServer} from "@terreno/api";

setupServer({
  userModel: User,
  plugins: [
    new HealthApp({
      check: async () => {
        const healthy = mongoose.connection.readyState === 1;
        return {
          healthy,
          details: {
            mongodb: healthy ? "connected" : "disconnected",
            uptime: process.uptime(),
            version: process.env.APP_VERSION,
          },
        };
      },
    }),
  ],
  addRoutes: (router) => {
    // Your routes
  },
});
```

## Response Examples

### Healthy (200)

```json
{
  "healthy": true
}
```

### Healthy with Details (200)

```json
{
  "healthy": true,
  "details": {
    "database": "connected",
    "cache": "connected",
    "uptime": 12345.67,
    "version": "1.0.0"
  }
}
```

### Unhealthy (503)

```json
{
  "healthy": false,
  "details": {
    "database": "disconnected",
    "cache": "connected"
  }
}
```

### Error During Check (503)

```json
{
  "healthy": false,
  "details": {
    "error": "Connection timeout"
  }
}
```

## Testing

```typescript
import {describe, expect, it} from "bun:test";
import express from "express";
import supertest from "supertest";
import {HealthApp} from "@terreno/api-health";

describe("HealthApp", () => {
  it("returns healthy: true by default", async () => {
    const app = express();
    new HealthApp().register(app);
    
    const res = await supertest(app).get("/health").expect(200);
    expect(res.body).toEqual({healthy: true});
  });

  it("calls custom check function", async () => {
    const app = express();
    new HealthApp({
      check: () => ({
        healthy: true,
        details: {db: "connected"},
      }),
    }).register(app);
    
    const res = await supertest(app).get("/health").expect(200);
    expect(res.body.details.db).toBe("connected");
  });
});
```

## Conventions

- Use `HealthApp` class as a plugin in setupServer
- Never expose sensitive information in health check responses (credentials, internal IPs, etc.)
- Health checks should be fast (< 1 second) to avoid timeout issues with load balancers
- Use 200 for healthy, 503 for unhealthy (standard HTTP status codes for health checks)
- Catch all errors in custom check functions to prevent health endpoint from crashing
- Use `logger.info/warn/error/debug` for permanent logs
- Testing: bun test with expect, supertest for HTTP requests
- Never include React, UI components, or frontend code
