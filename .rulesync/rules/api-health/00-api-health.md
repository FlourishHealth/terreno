---
description: '@terreno/api-health - Health check plugin for @terreno/api'
applyTo: '**/*'
---
# @terreno/api-health

Health check endpoint plugin for @terreno/api backends. Provides a simple GET endpoint for uptime monitoring, load balancers, and orchestration platforms. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Purpose

Adds a configurable health check endpoint to Express apps. Supports custom health checks (e.g., database connectivity, external service availability) and standard HTTP status codes for healthy/unhealthy responses.

## Key Exports

### HealthApp

```typescript
import {HealthApp} from "@terreno/api-health";

const healthApp = new HealthApp({
  enabled: true,           // Default: true
  path: "/health",         // Default: /health
  check: async () => {
    // Custom health check logic
    const dbHealthy = await mongoose.connection.db.admin().ping();
    return {
      healthy: dbHealthy,
      details: {database: "connected", timestamp: new Date().toISOString()},
    };
  },
});

// Register with Express app
healthApp.register(app);
```

### HealthOptions

```typescript
interface HealthOptions {
  enabled?: boolean;      // Enable/disable health endpoint (default: true)
  path?: string;          // Endpoint path (default: "/health")
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}
```

### HealthCheckResult

```typescript
interface HealthCheckResult {
  healthy: boolean;       // Overall health status
  details?: Record<string, any>;  // Optional diagnostic info
}
```

## Behavior

### Without Custom Check

```bash
GET /health
# 200 OK
{"healthy": true}
```

### With Custom Check (healthy)

```bash
GET /health
# 200 OK
{"healthy": true, "details": {"database": "connected", "timestamp": "2026-02-22T20:00:00.000Z"}}
```

### With Custom Check (unhealthy)

```bash
GET /health
# 503 Service Unavailable
{"healthy": false, "details": {"database": "disconnected"}}
```

### With Custom Check (error)

```bash
GET /health
# 503 Service Unavailable
{"healthy": false, "details": {"error": "Connection timeout"}}
```

## Integration with @terreno/api

HealthApp implements the TerrenoPlugin interface, so it can be registered via `setupServer`:

```typescript
import {HealthApp} from "@terreno/api-health";
import {setupServer} from "@terreno/api";

setupServer({
  userModel: User,
  plugins: [
    new HealthApp({
      check: async () => {
        const dbOk = mongoose.connection.readyState === 1;
        return {healthy: dbOk, details: {database: dbOk ? "connected" : "disconnected"}};
      },
    }),
  ],
});
```

## Conventions

- Health endpoint is unauthenticated (public access)
- Returns 200 for healthy, 503 for unhealthy
- Custom check function can be async or sync
- Errors in custom check are caught and returned as unhealthy
- Use `enabled: false` to disable in development or when not needed
