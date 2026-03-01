
# @terreno/api-health

Health check plugin for `@terreno/api` that provides a configurable health endpoint. This is a **backend-only** package — no React, no UI components, no frontend code.

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
  healthApp.ts           # HealthApp class - TerrenoPlugin implementation
  healthApp.test.ts      # Tests for HealthApp
  index.ts               # Package exports
```

## Quick Start

```typescript
import {HealthApp} from "@terreno/api-health";
import {TerrenoApp} from "@terreno/api";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();
```

This creates a `GET /health` endpoint that returns `{healthy: true}`.

## Custom Health Checks

Provide a custom check function for more complex health monitoring:

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
        details: {database: "disconnected"},
      };
    }
  },
});

const app = new TerrenoApp({userModel: User})
  .register(healthApp)
  .start();
```

## Configuration Options

```typescript
interface HealthOptions {
  enabled?: boolean;    // Whether the health endpoint is enabled (default: true)
  path?: string;        // Path for the health endpoint (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;  // Custom health check function
}

interface HealthCheckResult {
  healthy: boolean;                // Whether the service is healthy
  details?: Record<string, any>;   // Optional additional details about health status
}
```

## Response Codes

- **200** — Service is healthy
- **503** — Service is unhealthy (when `healthy: false` or check throws)

## Use Cases

- **Load balancer health checks** — Simple endpoint for GCP/AWS health monitoring
- **Database connectivity** — Test connection before accepting requests
- **Multi-service checks** — Verify external dependencies (Redis, APIs, etc.)
- **Kubernetes readiness/liveness probes**

## TerrenoPlugin Interface

HealthApp implements the `TerrenoPlugin` interface from `@terreno/api`:

```typescript
export class HealthApp implements TerrenoPlugin {
  register(app: express.Application): void {
    // Registers GET endpoint at configured path
  }
}
```

See `@terreno/api` documentation for more details on the TerrenoPlugin pattern.

## Best Practices

- Keep health checks fast (&lt;1s) — they run frequently
- Return specific details for debugging: `{database: "connected", cache: "ok"}`
- Use `/health` for liveness, custom paths for readiness checks
- Don't expose sensitive information in health check responses
- Use `try/catch` in custom checks to avoid unhandled rejections

## Testing

```typescript
import {describe, expect, it} from "bun:test";
import {HealthApp} from "@terreno/api-health";
import express from "express";
import request from "supertest";

describe("HealthApp", () => {
  it("returns healthy response", async () => {
    const app = express();
    new HealthApp().register(app);
    
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({healthy: true});
  });
});
```

- Framework: bun test with expect
- HTTP testing: supertest
- Test against real Express app instances

## Conventions

- Use TypeScript with ES modules
- Prefer const arrow functions over `function` keyword
- Use descriptive variable names
- Use `logger.info/warn/error/debug` for permanent logs from `@terreno/api`
- Testing: bun test with expect, supertest for HTTP requests
- Never mock `@terreno/api` or Express — test against real functionality
