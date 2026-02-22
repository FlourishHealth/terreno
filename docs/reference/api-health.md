# @terreno/api-health

Health check plugin for @terreno/api applications. Provides a production-ready `/health` endpoint with configurable health checks and TerrenoPlugin integration.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Custom Health Checks](#custom-health-checks)
- [Response Formats](#response-formats)
- [Examples](#examples)
- [API Reference](#api-reference)

## Overview

`@terreno/api-health` implements a health check endpoint that:

- Returns HTTP 200 when your application is healthy
- Returns HTTP 503 when unhealthy (for load balancer/orchestrator detection)
- Supports custom health check logic (database, external services, etc.)
- Integrates seamlessly with `setupServer()` via TerrenoPlugin interface
- Provides configurable endpoint paths and enable/disable flags

**Use cases:**
- Kubernetes/Docker liveness and readiness probes
- Load balancer health checks
- Monitoring system integration
- Service mesh health endpoints

## Installation

Already included as a workspace dependency in Terreno monorepos:

``````typescript
// package.json
{
  "dependencies": {
    "@terreno/api-health": "workspace:*"
  }
}
``````

For standalone installation:

``````bash
bun add @terreno/api-health
``````

## Quick Start

### Basic Setup

Add HealthApp to your `setupServer()` call:

``````typescript
import {setupServer} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

setupServer({
  userModel: User,
  plugins: [new HealthApp()],
  addRoutes: (router, options) => {
    // Your routes
  },
});
``````

This creates a `/health` endpoint that returns:

``````json
{"healthy": true}
``````

### Testing the Endpoint

``````bash
curl http://localhost:4000/health
# Response: {"healthy": true}
``````

## Configuration

### HealthOptions

``````typescript
interface HealthOptions {
  enabled?: boolean;         // Default: true
  path?: string;             // Default: "/health"
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}
``````

### HealthCheckResult

``````typescript
interface HealthCheckResult {
  healthy: boolean;
  details?: Record<string, any>;
}
``````

### Custom Path

``````typescript
new HealthApp({
  path: "/status"
})
``````

### Conditional Enablement

Disable health checks in development:

``````typescript
new HealthApp({
  enabled: process.env.NODE_ENV === "production"
})
``````

## Custom Health Checks

### Database Connectivity

``````typescript
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";

new HealthApp({
  check: async () => {
    try {
      // Check MongoDB connection
      const state = mongoose.connection.readyState;
      if (state !== 1) {
        return {
          healthy: false,
          details: {
            database: "disconnected",
            state: state
          }
        };
      }
      
      return {
        healthy: true,
        details: {
          database: "connected"
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          database: "error",
          error: (error as Error).message
        }
      };
    }
  }
})
``````

### Multi-Service Health Check

``````typescript
new HealthApp({
  check: async () => {
    const checks = {
      database: false,
      redis: false,
      s3: false
    };
    
    // Check MongoDB
    checks.database = mongoose.connection.readyState === 1;
    
    // Check Redis (example)
    try {
      await redisClient.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }
    
    // Check S3 (example)
    try {
      await s3Client.listBuckets();
      checks.s3 = true;
    } catch {
      checks.s3 = false;
    }
    
    const allHealthy = Object.values(checks).every(v => v);
    
    return {
      healthy: allHealthy,
      details: checks
    };
  }
})
``````

### Synchronous Checks

Health check functions can be synchronous:

``````typescript
new HealthApp({
  check: () => ({
    healthy: true,
    details: {
      version: process.env.APP_VERSION,
      uptime: process.uptime()
    }
  })
})
``````

## Response Formats

### Healthy Response (200 OK)

Default:
``````json
{
  "healthy": true
}
``````

With custom check:
``````json
{
  "healthy": true,
  "details": {
    "database": "connected",
    "uptime": 3600
  }
}
``````

### Unhealthy Response (503 Service Unavailable)

``````json
{
  "healthy": false,
  "details": {
    "database": "disconnected",
    "state": 0
  }
}
``````

### Error Response (503)

If the check function throws:

``````json
{
  "healthy": false,
  "details": {
    "error": "Connection timeout"
  }
}
``````

## Examples

### Example 1: Basic Health Check

``````typescript
import {setupServer} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";

setupServer({
  userModel: User,
  plugins: [new HealthApp()],
  addRoutes: (router) => {
    // Routes
  }
});
``````

### Example 2: Production-Only Health Checks

``````typescript
const healthPlugin = process.env.NODE_ENV === "production" 
  ? new HealthApp({
      check: async () => {
        const dbHealthy = mongoose.connection.readyState === 1;
        return {
          healthy: dbHealthy,
          details: {database: dbHealthy ? "connected" : "disconnected"}
        };
      }
    })
  : new HealthApp({enabled: false});

setupServer({
  userModel: User,
  plugins: [healthPlugin],
  addRoutes: (router) => {/* routes */}
});
``````

### Example 3: Kubernetes Probes

Use different paths for liveness vs readiness:

``````typescript
// Liveness probe: is the app running?
const livenessProbe = new HealthApp({
  path: "/healthz",
  check: () => ({healthy: true})
});

// Readiness probe: can the app serve traffic?
const readinessProbe = new HealthApp({
  path: "/ready",
  check: async () => {
    const dbReady = mongoose.connection.readyState === 1;
    return {
      healthy: dbReady,
      details: {database: dbReady ? "ready" : "not ready"}
    };
  }
});

setupServer({
  userModel: User,
  plugins: [livenessProbe, readinessProbe],
  addRoutes: (router) => {/* routes */}
});
``````

Kubernetes deployment:

``````yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /ready
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 10
``````

### Example 4: Real-World Implementation

From `example-backend`:

``````typescript
import {setupServer, configureOpenApiValidator} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";

setupServer({
  userModel: User,
  plugins: [
    new HealthApp({
      check: async () => {
        // Check critical services
        const mongoState = mongoose.connection.readyState;
        
        return {
          healthy: mongoState === 1,
          details: {
            mongodb: mongoState === 1 ? "connected" : "disconnected",
            uptime: Math.floor(process.uptime()),
            version: process.env.APP_VERSION || "dev"
          }
        };
      }
    })
  ],
  addRoutes: (router, options) => {
    addTodoRoutes(router, options);
    addUserRoutes(router, options);
  }
});
``````

## API Reference

### Class: HealthApp

Implements `TerrenoPlugin` interface.

**Constructor:**

``````typescript
constructor(options?: HealthOptions)
``````

**Methods:**

``````typescript
register(app: express.Application): void
``````

Registers the health check route with the Express application.

### Interface: HealthOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean?` | `true` | Whether to register the health endpoint |
| `path` | `string?` | `"/health"` | HTTP path for the health endpoint |
| `check` | `Function?` | `undefined` | Custom health check function |

### Interface: HealthCheckResult

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `healthy` | `boolean` | Yes | Overall health status |
| `details` | `Record<string, any>?` | No | Additional health information |

### Type: check Function

``````typescript
() => Promise<HealthCheckResult> | HealthCheckResult
``````

Can be synchronous or asynchronous. If it throws an error, returns 503 with error message in details.

## Source Code

- Implementation: [api-health/src/healthApp.ts](../../api-health/src/healthApp.ts)
- Tests: [api-health/src/healthApp.test.ts](../../api-health/src/healthApp.test.ts)
- Example usage: [example-backend/src/server.ts](../../example-backend/src/server.ts)

## Related Documentation

- [TerrenoPlugin Interface](./api.md#extensibility-with-terrenoplugin) — Plugin system overview
- [setupServer()](./api.md#setupserver) — Server setup and plugin registration
- [Environment Variables](./environment-variables.md) — Configuration via env vars
