---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/api-health - Health check plugin for @terreno/api"
globs: ["**/*"]
---

# @terreno/api-health

Health check plugin for @terreno/api that provides a standardized health endpoint. Implements the TerrenoPlugin interface for easy integration. This is a **backend-only** package — no React, no UI components, no frontend code.

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
  healthApp.ts           # HealthApp plugin class
  healthApp.test.ts      # Tests
```

## Key Exports

```typescript
import {
  HealthApp,              // TerrenoPlugin for health checks
  type HealthOptions,     // Configuration interface
  type HealthCheckResult, // Result interface
} from "@terreno/api-health";
```

## Usage

### Basic Health Check

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";
import {User} from "./models";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();

// Creates GET /health endpoint that returns { healthy: true }
```

### Custom Health Check

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
        details: {
          database: "connected",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          database: "disconnected",
          error: error.message,
        },
      };
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
  enabled?: boolean;    // Enable/disable health endpoint (default: true)
  path?: string;        // Endpoint path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;  // Custom check function
}

interface HealthCheckResult {
  healthy: boolean;     // Overall health status
  details?: Record<string, any>;  // Additional health details
}
```

## Response Format

### Healthy Response (200)

```json
{
  "healthy": true,
  "details": {
    "database": "connected",
    "timestamp": "2026-03-02T15:00:00.000Z"
  }
}
```

### Unhealthy Response (503)

```json
{
  "healthy": false,
  "details": {
    "database": "disconnected",
    "error": "Connection timeout"
  }
}
```

## Features

- **TerrenoPlugin interface**: Implements standard plugin pattern for easy registration
- **Customizable path**: Configure the health endpoint path
- **Custom check logic**: Provide your own health check function for complex monitoring
- **Automatic error handling**: Catches exceptions in check functions and returns 503
- **Optional details**: Include additional health information in the response
- **Default behavior**: Returns healthy if no custom check is provided

## Common Health Checks

### Database Connection

```typescript
check: async () => {
  try {
    await mongoose.connection.db.admin().ping();
    return {healthy: true, details: {database: "connected"}};
  } catch (error) {
    return {healthy: false, details: {database: error.message}};
  }
}
```

### Multiple Services

```typescript
check: async () => {
  const checks = await Promise.allSettled([
    mongoose.connection.db.admin().ping(),
    redis.ping(),
    externalApiHealthCheck(),
  ]);
  
  const healthy = checks.every(c => c.status === "fulfilled");
  return {
    healthy,
    details: {
      database: checks[0].status === "fulfilled" ? "ok" : "error",
      redis: checks[1].status === "fulfilled" ? "ok" : "error",
      externalApi: checks[2].status === "fulfilled" ? "ok" : "error",
    },
  };
}
```

## Conventions

- Use TypeScript with ES modules
- Prefer const arrow functions over `function` keyword
- Named exports preferred
- Use `logger.info/warn/error/debug` for permanent logs (import from @terreno/api)
- Testing: bun test with expect
