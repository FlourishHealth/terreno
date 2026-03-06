---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/api-health - Health check plugin for @terreno/api"
globs: ["**/*"]
---

# @terreno/api-health

Health check plugin for @terreno/api that provides a simple health check endpoint. This is a **backend-only** package — no React, no UI components, no frontend code.

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
  healthApp.ts           # HealthApp TerrenoPlugin class
  healthApp.test.ts      # Tests
```

## Usage

The `HealthApp` class implements the `TerrenoPlugin` interface and can be registered with `TerrenoApp` or used with `setupServer`.

### Basic Usage

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();
```

This creates a `GET /health` endpoint that returns `{healthy: true}`.

### Custom Health Check

```typescript
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
```

### Configuration Options

```typescript
interface HealthOptions {
  enabled?: boolean;     // Enable/disable the endpoint (default: true)
  path?: string;         // Endpoint path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;  // Custom check function
}
```

## Response Format

**Healthy (200 OK):**

```json
{
  "healthy": true,
  "details": {
    "database": "connected"
  }
}
```

**Unhealthy (503 Service Unavailable):**

```json
{
  "healthy": false,
  "details": {
    "database": "disconnected"
  }
}
```

## Conventions

- Use `HealthApp` to add health checks to your Terreno applications
- Implement custom `check` functions to verify database connections, external service availability, or other health criteria
- Return appropriate HTTP status codes (200 for healthy, 503 for unhealthy)
- Use `logger.info/warn/error/debug` for permanent logs
- Testing: bun test with expect, supertest for HTTP requests

## Integration with TerrenoPlugin

The `HealthApp` class demonstrates the `TerrenoPlugin` interface pattern:

```typescript
export class HealthApp implements TerrenoPlugin {
  register(app: express.Application): void {
    // Register routes and middleware
  }
}
```

This pattern allows modular, reusable functionality that can be easily composed into Terreno applications.
