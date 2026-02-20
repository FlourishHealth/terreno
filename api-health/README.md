# @terreno/api-health

Health check plugin for @terreno/api applications.

## Features

- Simple `/health` endpoint for monitoring
- Customizable health check logic
- Configurable endpoint path
- Returns 200 OK when healthy, 503 Service Unavailable when unhealthy
- Compatible with TerrenoApp plugin system

## Installation

This package is part of the Terreno workspace. Add it as a dependency:

```bash
bun install @terreno/api-health
```

## Usage

### Basic Health Check

```typescript
import {TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

const app = new TerrenoApp()
  .addPlugin(new HealthApp())
  .build();
```

This creates a `/health` endpoint that returns `{healthy: true}`.

### Custom Health Check Logic

```typescript
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";

const app = new TerrenoApp()
  .addPlugin(new HealthApp({
    check: async () => {
      // Check database connectivity
      const dbHealthy = mongoose.connection.readyState === 1;
      
      return {
        healthy: dbHealthy,
        details: {
          database: dbHealthy ? "connected" : "disconnected",
          timestamp: new Date().toISOString(),
        },
      };
    },
  }))
  .build();
```

### Configuration Options

```typescript
interface HealthOptions {
  // Enable/disable health check endpoint (default: true)
  enabled?: boolean;
  
  // Custom endpoint path (default: "/health")
  path?: string;
  
  // Custom health check function
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

interface HealthCheckResult {
  // Whether the service is healthy
  healthy: boolean;
  
  // Additional details to include in response
  details?: Record<string, any>;
}
```

### Custom Path

```typescript
const app = new TerrenoApp()
  .addPlugin(new HealthApp({
    path: "/api/health",
  }))
  .build();
```

### Disable Health Check

```typescript
const app = new TerrenoApp()
  .addPlugin(new HealthApp({
    enabled: false,
  }))
  .build();
```

## Response Format

**Healthy (200 OK):**

```json
{
  "healthy": true
}
```

**Healthy with details (200 OK):**

```json
{
  "healthy": true,
  "details": {
    "database": "connected",
    "timestamp": "2026-02-20T22:00:00.000Z"
  }
}
```

**Unhealthy (503 Service Unavailable):**

```json
{
  "healthy": false,
  "details": {
    "database": "disconnected",
    "error": "Connection timeout"
  }
}
```

## Use Cases

### Kubernetes Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
```

### Load Balancer Health Check

Configure your load balancer (AWS ELB, GCP Load Balancer, etc.) to poll `/health` and remove unhealthy instances from rotation.

### Monitoring & Alerting

Use monitoring tools (Datadog, New Relic, etc.) to poll `/health` and alert on failures.

## Example: Database + Cache Health

```typescript
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";
import Redis from "ioredis";

const redis = new Redis();

const app = new TerrenoApp()
  .addPlugin(new HealthApp({
    check: async () => {
      const checks = {
        database: false,
        cache: false,
      };

      // Check MongoDB
      try {
        checks.database = mongoose.connection.readyState === 1;
      } catch (error) {
        checks.database = false;
      }

      // Check Redis
      try {
        await redis.ping();
        checks.cache = true;
      } catch (error) {
        checks.cache = false;
      }

      const healthy = checks.database && checks.cache;

      return {
        healthy,
        details: {
          ...checks,
          timestamp: new Date().toISOString(),
        },
      };
    },
  }))
  .build();
```

## Development

```bash
# Compile TypeScript
bun run compile

# Watch mode
bun run dev

# Run tests
bun run test

# Lint code
bun run lint

# Fix lint issues
bun run lint:fix
```

## Testing

```typescript
import {describe, expect, it} from "bun:test";
import request from "supertest";
import express from "express";
import {HealthApp} from "@terreno/api-health";

describe("HealthApp", () => {
  it("returns healthy status", async () => {
    const app = express();
    const health = new HealthApp();
    health.register(app);

    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.healthy).toBe(true);
  });

  it("returns unhealthy status on check failure", async () => {
    const app = express();
    const health = new HealthApp({
      check: () => ({healthy: false, details: {error: "Service down"}}),
    });
    health.register(app);

    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
    expect(response.body.healthy).toBe(false);
  });
});
```

## Learn More

- [Terreno Documentation](../docs/README.md)
- [@terreno/api Reference](../docs/reference/api.md)
- [Implementation Plans](../docs/implementationPlans/ModularAPI.md) - TerrenoApp plugin system

## License

Apache-2.0
