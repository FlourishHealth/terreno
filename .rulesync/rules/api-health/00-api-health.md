---
description: '@terreno/api-health - Health check plugin for @terreno/api'
applyTo: '**/*'
---
# @terreno/api-health

Health check plugin for @terreno/api backends. Implements the TerrenoPlugin interface to provide customizable health check endpoints. This is a **backend-only** package — no React, no UI components, no frontend code.

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
  index.ts               # Package exports (HealthApp, types)
  healthApp.ts           # HealthApp class implementing TerrenoPlugin
  healthApp.test.ts      # Test suite
```

## HealthApp Plugin

Implements the `TerrenoPlugin` interface from @terreno/api to provide health check endpoints.

### Usage

```typescript
import {HealthApp} from "@terreno/api-health";
import {setupServer} from "@terreno/api";

const healthCheck = new HealthApp({
  path: "/health",       // Optional, defaults to "/health"
  enabled: true,         // Optional, defaults to true
  check: async () => ({  // Optional custom health check
    healthy: true,
    details: {db: "connected", uptime: process.uptime()},
  }),
});

setupServer({
  userModel: User,
  addRoutes: (router) => {
    healthCheck.register(router as any);
  },
});
```

### Options

```typescript
interface HealthOptions {
  enabled?: boolean;     // Enable/disable health endpoint (default: true)
  path?: string;         // Health check path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;  // Custom health check function
}

interface HealthCheckResult {
  healthy: boolean;      // Overall health status
  details?: Record<string, any>;  // Additional health details
}
```

### Behavior

- **Default response**: Returns `{healthy: true}` with 200 status when no custom check is provided
- **Custom check (healthy)**: Returns check result with 200 status
- **Custom check (unhealthy)**: Returns check result with 503 status
- **Custom check (error)**: Returns `{healthy: false, details: {error: message}}` with 503 status
- **Disabled**: When `enabled: false`, no route is registered

### Response Examples

```typescript
// Default (no custom check)
GET /health → 200 {healthy: true}

// Custom check returning healthy
GET /health → 200 {healthy: true, details: {db: "connected"}}

// Custom check returning unhealthy
GET /health → 503 {healthy: false, details: {db: "disconnected"}}

// Custom check throwing error
GET /health → 503 {healthy: false, details: {error: "DB connection failed"}}
```

## Plugin Pattern

HealthApp demonstrates the TerrenoPlugin pattern for creating reusable @terreno/api extensions:

```typescript
import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

export class HealthApp implements TerrenoPlugin {
  private options: HealthOptions;

  constructor(options?: HealthOptions) {
    this.options = options ?? {};
  }

  register(app: express.Application): void {
    // Add routes, middleware, or services
  }
}
```

**Benefits:**
- Reusable across multiple Terreno projects
- Testable in isolation
- Optional/configurable functionality
- Clean separation of concerns

## Testing

```typescript
import {describe, expect, it} from "bun:test";
import express from "express";
import supertest from "supertest";
import {HealthApp} from "@terreno/api-health";

const createApp = (healthApp: HealthApp): express.Express => {
  const app = express();
  healthApp.register(app);
  return app;
};

it("returns healthy: true by default", async () => {
  const app = createApp(new HealthApp());
  const res = await supertest(app).get("/health").expect(200);
  expect(res.body).toEqual({healthy: true});
});
```

- Framework: bun test with expect
- HTTP testing: supertest
- Test all options: default, custom path, enabled/disabled, custom checks, errors

## Conventions

- Implements TerrenoPlugin interface from @terreno/api
- Uses TypeScript with ES modules
- Prefer const arrow functions
- Use `express.Application` type for app parameter
- Use `logger.info/warn/error/debug` for permanent logs (if logging is needed)
- Handle both sync and async custom check functions
- Catch and convert errors to health check failures (503)
