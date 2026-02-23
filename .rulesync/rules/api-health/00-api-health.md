---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/api-health - Health check plugin for @terreno/api"
globs: ["**/*"]
---

# @terreno/api-health

Health check plugin for @terreno/api backends. Provides a simple health check endpoint with optional custom health checks. This is a **backend-only** package — no React, no UI components, no frontend code.

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
  healthApp.ts           # HealthApp class implementing TerrenoPlugin
  healthApp.test.ts      # Tests
```

## HealthApp

A TerrenoPlugin that adds a health check endpoint to your API.

### Basic Usage

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();

// GET /health -> {healthy: true}
```

### Custom Health Checks

```typescript
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp({
    path: "/api/health",  // Default: "/health"
    enabled: true,         // Default: true
    check: async () => {
      // Custom health check logic
      const dbConnected = mongoose.connection.readyState === 1;
      return {
        healthy: dbConnected,
        details: {
          database: dbConnected ? "connected" : "disconnected",
          timestamp: new Date().toISOString(),
        },
      };
    },
  }))
  .start();

// GET /api/health -> {healthy: true, details: {...}}
// Returns 200 if healthy, 503 if not
```

## Types

```typescript
interface HealthCheckResult {
  healthy: boolean;
  details?: Record<string, any>;
}

interface HealthOptions {
  enabled?: boolean;                                      // Enable/disable health check (default: true)
  path?: string;                                          // Endpoint path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;  // Custom health check
}
```

## Response Codes

- **200 OK** — Health check passed (healthy: true)
- **503 Service Unavailable** — Health check failed (healthy: false or error thrown)

## Error Handling

If the custom check function throws an error:

```json
{
  "healthy": false,
  "details": {
    "error": "Database connection failed"
  }
}
```

## Conventions

- Use TypeScript with ES modules
- Prefer const arrow functions
- Named exports preferred
- Use `logger.info/warn/error/debug` for permanent logs (from @terreno/api)
- Testing: bun test with expect, supertest for HTTP requests

## Integration with TerrenoApp

HealthApp implements the `TerrenoPlugin` interface:

```typescript
interface TerrenoPlugin {
  register(app: express.Application): void;
}
```

This allows it to be registered with `TerrenoApp.register()` alongside model routers and other plugins (AdminApp, custom middleware, etc.).
