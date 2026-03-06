---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/api-health - Health check plugin for @terreno/api"
globs: ["**/*"]
---

# @terreno/api-health

Health check plugin for @terreno/api that provides a customizable health endpoint. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode (TypeScript watch)
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
bun run test             # Run tests
```

## Architecture

### File Structure

```
src/
  healthApp.ts           # HealthApp class - TerrenoPlugin implementation
  healthApp.test.ts      # Tests
  index.ts               # Package exports
```

### Key Concepts

The health check plugin provides:
- **HealthApp class**: TerrenoPlugin that registers a health check endpoint
- **Customizable health checks**: Optional custom check function for complex health monitoring
- **Standard health endpoint**: GET `/health` (default) with JSON response
- **Status codes**: 200 for healthy, 503 for unhealthy

## Usage

### Basic Usage (Always Healthy)

```typescript
import {HealthApp} from "@terreno/api-health";
import {TerrenoApp} from "@terreno/api";

const app = new TerrenoApp({userModel: User})
  .register(new HealthApp())
  .start();

// GET /health -> {healthy: true}
```

### Custom Health Check

```typescript
import {HealthApp} from "@terreno/api-health";
import {TerrenoApp} from "@terreno/api";
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

// GET /api/health -> {healthy: true, details: {database: "connected"}}
```

### With Legacy setupServer

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

## HealthApp Options

```typescript
interface HealthOptions {
  /** Whether the health endpoint is enabled (default: true) */
  enabled?: boolean;
  /** Path for the health endpoint (default: "/health") */
  path?: string;
  /** Optional custom health check function. If not provided, always returns healthy. */
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

interface HealthCheckResult {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Optional additional details about the health status */
  details?: Record<string, any>;
}
```

## Response Format

### Healthy Response (200)

```json
{
  "healthy": true,
  "details": {
    "database": "connected",
    "redis": "connected"
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

## Common Health Check Patterns

### Database Connection

```typescript
check: async () => {
  try {
    await mongoose.connection.db.admin().ping();
    return {healthy: true, details: {database: "connected"}};
  } catch (error) {
    return {healthy: false, details: {database: "disconnected", error: error.message}};
  }
}
```

### Multiple Service Checks

```typescript
check: async () => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    externalApi: await checkExternalApi(),
  };
  
  const allHealthy = Object.values(checks).every(c => c.healthy);
  
  return {
    healthy: allHealthy,
    details: checks,
  };
}
```

### Uptime and Version Info

```typescript
const startTime = Date.now();

check: async () => {
  return {
    healthy: true,
    details: {
      uptime: Date.now() - startTime,
      version: process.env.npm_package_version,
      nodeVersion: process.version,
    },
  };
}
```

## Integration with Monitoring

The health endpoint is designed to work with:
- Kubernetes liveness/readiness probes
- AWS ELB/ALB health checks
- Docker HEALTHCHECK
- Monitoring services (Datadog, New Relic, etc.)

Example Kubernetes probe:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 30
```

## Conventions

- Use `HealthApp` to register health check in your TerrenoApp setup
- Always provide meaningful `details` in custom checks (helps with debugging)
- Return `healthy: false` only when the service cannot handle requests
- Use `logger.info/warn/error/debug` for permanent logs
- Testing: bun test with expect, supertest for HTTP requests

## Error Handling

- If the custom `check` function throws an error, the endpoint returns 503 with error details
- Uncaught errors in the check function are caught and returned as `{healthy: false, details: {error: message}}`
- If health check is disabled (`enabled: false`), the endpoint is not registered
