# Modular API Implementation Plan

## Overview

This document outlines the implementation plan for a new modular API design in `@terreno/api`. The goal is to create a `TerrenoApp` class that provides a cleaner, more flexible interface for building APIs while maintaining backward compatibility with the existing `setupServer` function.

## Goals

1. **Fluent Builder API**: `const app = TerrenoApp.create({...}).addModelRouter(...).addRoute(...)`
2. **Comprehensive Hooks**: Lifecycle hooks at every stage of server initialization and request handling
3. **Configuration over Environment**: All settings passed via options, not env vars
4. **Toggleable Middleware**: Every default middleware can be enabled/disabled
5. **Health Checks**: Built-in `/health` endpoint with optional custom health check function
6. **Breaking Change**: This replaces `setupServer` - no backward compatibility layer

---

## Architecture

### File Structure

```
api/src/
├── TerrenoApp.ts              # Main TerrenoApp class (NEW)
├── TerrenoAppOptions.ts       # Types and defaults (NEW)
├── TerrenoAppMiddleware.ts    # Built-in middleware configurations (NEW)
├── TerrenoAppHooks.ts         # Hook type definitions and runner (NEW)
├── expressServer.ts           # DEPRECATED - to be removed in future version
├── api.ts                     # Existing - unchanged
└── index.ts                   # Export TerrenoApp, remove setupServer exports
```

### Core Classes

```typescript
// TerrenoApp.ts
class TerrenoApp {
  static create(options: TerrenoAppOptions): TerrenoApp;

  // Fluent configuration
  addModelRouter<T>(path: string, model: Model<T>, options: ModelRouterOptions<T>): this;
  addModelRouter<T>(path: string, model: Model<T>, permissions: RESTPermissions<T>): this;  // Shorthand
  addRoute(path: string, router: Router | AddRoutesCallback): this;
  addMiddleware(middleware: RequestHandler, options?: MiddlewareOptions): this;

  // WebSocket
  enableWebSocket(options?: WebSocketOptions): this;

  // Lifecycle
  build(): Express;  // Returns configured Express app without starting
  start(): Promise<{ app: Express; server: Server; wss?: WebSocketServer }>;  // Build + listen

  // Access
  getExpressApp(): Express;
  getServer(): Server | null;
  getWebSocketServer(): WebSocketServer | null;

  // Shutdown
  shutdown(): Promise<void>;  // Graceful shutdown
}
```

---

## Configuration Options

### TerrenoAppOptions Interface

```typescript
interface TerrenoAppOptions {
  // === Authentication ===
  auth: AuthOptions;

  // === Server ===
  server?: ServerOptions;

  // === Logging ===
  logging?: LoggingOptions;

  // === Middleware ===
  middleware?: MiddlewareOptions;

  // === Health Check ===
  health?: HealthOptions;

  // === OpenAPI / Swagger ===
  openApi?: OpenApiOptions;

  // === Error Handling ===
  errors?: ErrorOptions;

  // === WebSocket ===
  webSocket?: WebSocketOptions;

  // === Graceful Shutdown ===
  shutdown?: ShutdownOptions;

  // === Hooks ===
  hooks?: AppHooks;
}
```

### Detailed Option Types

#### AuthOptions

```typescript
interface AuthOptions {
  // User model for authentication (required)
  userModel: Model<any>;

  // Token configuration (replaces env vars)
  token: {
    issuer: string;                    // TOKEN_ISSUER
    secret: string;                    // TOKEN_SECRET
    expiresIn?: string;                // TOKEN_EXPIRES_IN (default: '1h')
  };

  refreshToken?: {
    secret: string;                    // REFRESH_TOKEN_SECRET
    expiresIn?: string;                // REFRESH_TOKEN_EXPIRES_IN (default: '7d')
  };

  session?: {
    secret: string;                    // SESSION_SECRET
  };

  // Auth scheme customization
  scheme?: 'jwt' | 'custom';

  // Custom token generation (existing authOptions.generateToken)
  generateToken?: (user: any) => TokenPayload;

  // Enable/disable built-in auth routes (/auth/login, /auth/signup, etc.)
  enableAuthRoutes?: boolean;          // default: true

  // Enable/disable /me route
  enableMeRoute?: boolean;             // default: true
}
```

#### ServerOptions

```typescript
interface ServerOptions {
  port?: number;                       // default: 9000
  skipListen?: boolean;                // default: false (for testing)
  trustProxy?: boolean | string;       // Express trust proxy setting
}
```

#### LoggingOptions

```typescript
interface LoggingOptions {
  // Request logging
  requests?: {
    enabled?: boolean;                 // default: true
    maskFields?: string[];             // Fields to mask (default: ['password'])
  };

  // Slow request logging
  slowRequests?: {
    enabled?: boolean;                 // default: false
    readThresholdMs?: number;          // default: 200
    writeThresholdMs?: number;         // default: 500
  };

  // Logger configuration
  logger?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    format?: 'json' | 'pretty';
  };
}
```

#### MiddlewareOptions

```typescript
interface MiddlewareOptions {
  // CORS
  cors?: {
    enabled?: boolean;                 // default: true
    origin?: string | string[] | RegExp | boolean;
    credentials?: boolean;
  } | false;                           // false to disable

  // JSON body parsing
  json?: {
    enabled?: boolean;                 // default: true
    limit?: string;                    // default: '100kb'
  } | false;

  // Query string parsing
  queryParser?: {
    enabled?: boolean;                 // default: true
    arrayLimit?: number;               // default: 200
  } | false;

  // Helmet security headers
  helmet?: {
    enabled?: boolean;                 // default: false (opt-in)
    options?: HelmetOptions;
  } | false;

  // Rate limiting
  rateLimit?: {
    enabled?: boolean;                 // default: false (opt-in)
    windowMs?: number;
    max?: number;
  } | false;

  // Compression
  compression?: {
    enabled?: boolean;                 // default: false (opt-in)
  } | false;
}
```

#### HealthOptions

```typescript
interface HealthOptions {
  enabled?: boolean;                   // default: true
  path?: string;                       // default: '/health'

  // Optional custom health check function
  // Return { healthy: boolean, details?: any } or throw to indicate unhealthy
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

interface HealthCheckResult {
  healthy: boolean;
  details?: Record<string, any>;
}
```

#### OpenApiOptions

```typescript
interface OpenApiOptions {
  enabled?: boolean;                   // default: true
  path?: string;                       // default: '/openapi.json'

  // Swagger UI
  swagger?: {
    enabled?: boolean;                 // default: false
    path?: string;                     // default: '/swagger'
  };

  // OpenAPI spec metadata
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
}
```

#### ErrorOptions

```typescript
interface ErrorOptions {
  // Sentry integration
  sentry?: {
    enabled?: boolean;
    dsn?: string;
    environment?: string;
    options?: SentryOptions;
  } | false;

  // Include stack traces in error responses
  includeStackTrace?: boolean;         // default: false (true in dev)
}
```

#### WebSocketOptions

```typescript
interface WebSocketOptions {
  enabled?: boolean;                   // default: false

  // Path for WebSocket upgrades (default: use same server)
  path?: string;                       // e.g., '/ws'

  // Authentication for WebSocket connections
  authenticate?: (request: IncomingMessage) => Promise<any | null> | any | null;

  // Called when a new connection is established
  onConnection?: (ws: WebSocket, user: any | null) => void;

  // Called when a message is received
  onMessage?: (ws: WebSocket, message: Buffer, user: any | null) => void;

  // Called when a connection is closed
  onClose?: (ws: WebSocket, code: number, reason: string, user: any | null) => void;

  // Called on WebSocket error
  onError?: (ws: WebSocket, error: Error, user: any | null) => void;

  // ws library options
  wsOptions?: WebSocketServerOptions;
}
```

#### ShutdownOptions

```typescript
interface ShutdownOptions {
  // Enable automatic SIGTERM/SIGINT handling (default: true)
  handleSignals?: boolean;

  // Timeout for graceful shutdown in ms (default: 30000)
  timeout?: number;

  // Called before shutdown begins
  onShutdown?: () => void | Promise<void>;
}
```

---

## Hooks System

### AppHooks Interface

```typescript
interface AppHooks {
  // === Initialization Hooks ===

  // Called immediately after Express app is created, before any middleware
  onAppCreated?: (app: Express) => void | Promise<void>;

  // Called after core middleware (cors, json, query) but before auth
  onCoreMiddlewareReady?: (app: Express) => void | Promise<void>;

  // Called after auth is configured but before routes
  onAuthReady?: (app: Express) => void | Promise<void>;

  // Called after all routes are registered but before error handlers
  onRoutesReady?: (app: Express) => void | Promise<void>;

  // Called after all middleware and error handlers are set up
  onReady?: (app: Express) => void | Promise<void>;

  // Called after server starts listening
  onListening?: (server: Server, port: number) => void | Promise<void>;

  // Called after WebSocket server is created (if enabled)
  onWebSocketReady?: (wss: WebSocketServer) => void | Promise<void>;

  // === Request Lifecycle Hooks ===

  // Called for every request before any processing
  onRequest?: (req: Request, res: Response) => void | Promise<void>;

  // Called after authentication middleware runs
  onAuthenticated?: (req: Request, res: Response, user: any | null) => void | Promise<void>;

  // Called before sending response
  onResponse?: (req: Request, res: Response, body: any) => void | Promise<void>;

  // Called when an error occurs
  onError?: (error: Error, req: Request, res: Response) => void | Promise<void>;
}
```

### Hook Execution Points

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIALIZATION PHASE                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Express app created                                         │
│     └── onAppCreated()                                          │
│                                                                 │
│  2. Core middleware: cors, json, queryParser                    │
│     └── onCoreMiddlewareReady()                                 │
│                                                                 │
│  3. Auth: setupAuth(), addAuthRoutes()                          │
│     └── onAuthReady()                                           │
│                                                                 │
│  4. Routes: health, openapi, model routers, custom routes       │
│     └── onRoutesReady()                                         │
│                                                                 │
│  5. Error handlers: sentry, apiError, fallthrough               │
│     └── onReady()                                               │
│                                                                 │
│  6. Server.listen()                                             │
│     └── onListening()                                           │
│                                                                 │
│  7. WebSocket server created (if enabled)                       │
│     └── onWebSocketReady()                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     REQUEST PHASE                               │
├─────────────────────────────────────────────────────────────────┤
│  Request arrives                                                │
│     └── onRequest()                                             │
│                                                                 │
│  Authentication runs                                            │
│     └── onAuthenticated()                                       │
│                                                                 │
│  Route handler executes                                         │
│                                                                 │
│  Response sending                                               │
│     └── onResponse()                                            │
│                                                                 │
│  Error (if any)                                                 │
│     └── onError()                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Usage Examples

### Basic Setup

```typescript
import { TerrenoApp } from '@terreno/api';
import { User } from './models/User';

const app = TerrenoApp.create({
  auth: {
    userModel: User,
    token: {
      issuer: 'my-app',
      secret: process.env.TOKEN_SECRET!,
      expiresIn: '2h',
    },
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_SECRET!,
    },
    session: {
      secret: process.env.SESSION_SECRET!,
    },
  },
  server: {
    port: 3000,
  },
});

await app.start();
```

### Adding Model Routers

```typescript
import { TerrenoApp, Permissions } from '@terreno/api';
import { User, Post, Comment } from './models';

const app = TerrenoApp.create({ auth: { userModel: User, ... } })
  // Full options
  .addModelRouter('/posts', Post, {
    permissions: {
      create: [Permissions.IsAuthenticated],
      read: [Permissions.IsAny],
      update: [Permissions.IsOwner],
      delete: [Permissions.IsOwner],
      list: [Permissions.IsAny],
    },
    queryFields: ['title', 'authorId'],
  })
  // Shorthand: just pass permissions object directly
  .addModelRouter('/comments', Comment, {
    create: [Permissions.IsAuthenticated],
    read: [Permissions.IsAny],
    update: [Permissions.IsOwner],
    delete: [Permissions.IsOwner],
    list: [Permissions.IsAny],
  });

await app.start();
```

The shorthand detects when you pass a permissions object directly (has `create`/`read`/`update`/`delete`/`list` keys) vs full ModelRouterOptions (has `permissions` key).

### Adding Custom Routes

```typescript
const app = TerrenoApp.create({ ... })
  // Add route with a router
  .addRoute('/webhooks', webhookRouter)

  // Add route with a callback function
  .addRoute('/custom', (router) => {
    router.get('/ping', (req, res) => res.json({ pong: true }));
    router.post('/echo', (req, res) => res.json(req.body));
  })

  // Mount at root
  .addRoute('/', (router) => {
    router.get('/version', (req, res) => res.json({ version: '1.0.0' }));
  });
```

### Configuring Middleware

```typescript
const app = TerrenoApp.create({
  auth: { ... },
  middleware: {
    cors: {
      enabled: true,
      origin: ['https://myapp.com', 'https://admin.myapp.com'],
      credentials: true,
    },
    json: {
      limit: '10mb',
    },
    helmet: {
      enabled: true,
    },
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
    },
  },
});
```

### Custom Health Check

```typescript
const app = TerrenoApp.create({
  auth: { ... },
  health: {
    enabled: true,
    path: '/health',
    check: async () => {
      const dbConnected = mongoose.connection.readyState === 1;
      const redisConnected = await redis.ping().catch(() => false);

      return {
        healthy: dbConnected && redisConnected,
        details: {
          database: dbConnected ? 'connected' : 'disconnected',
          redis: redisConnected ? 'connected' : 'disconnected',
          uptime: process.uptime(),
        },
      };
    },
  },
});
```

### Using Hooks

```typescript
const app = TerrenoApp.create({
  auth: { ... },
  hooks: {
    onAppCreated: (app) => {
      console.log('Express app created');
    },

    onAuthReady: (app) => {
      // Add custom auth middleware after built-in auth
      app.use('/admin', adminAuthMiddleware);
    },

    onRoutesReady: (app) => {
      // Add routes that need to come after model routers
      app.use('/analytics', analyticsRouter);
    },

    onReady: (app) => {
      console.log('App fully configured');
    },

    onListening: (server, port) => {
      console.log(`Server listening on port ${port}`);
    },

    onRequest: (req, res) => {
      req.startTime = Date.now();
    },

    onError: (error, req, res) => {
      // Custom error tracking
      errorTracker.capture(error, { url: req.url, user: req.user?.id });
    },

    onShutdown: async () => {
      await mongoose.disconnect();
      await redis.quit();
    },
  },
});
```

### Adding Custom Middleware

```typescript
const app = TerrenoApp.create({ ... })
  // Add middleware that runs for all routes
  .addMiddleware(requestIdMiddleware)

  // Add middleware with options
  .addMiddleware(customMiddleware, {
    path: '/api',           // Only apply to /api routes
    position: 'afterAuth',  // Insert after auth middleware
  });
```

### WebSocket Support

```typescript
const app = TerrenoApp.create({
  auth: { ... },
  webSocket: {
    enabled: true,
    path: '/ws',

    // Authenticate WebSocket connections using the same JWT system
    authenticate: async (request) => {
      const token = new URL(request.url!, 'http://localhost').searchParams.get('token');
      if (!token) return null;
      return verifyToken(token);  // Returns user or null
    },

    onConnection: (ws, user) => {
      console.log(`User ${user?.id ?? 'anonymous'} connected`);
      ws.send(JSON.stringify({ type: 'welcome', userId: user?.id }));
    },

    onMessage: (ws, message, user) => {
      const data = JSON.parse(message.toString());
      // Handle message...
    },

    onClose: (ws, code, reason, user) => {
      console.log(`User ${user?.id} disconnected: ${code}`);
    },
  },
  hooks: {
    onWebSocketReady: (wss) => {
      // Access the raw WebSocket server for advanced use cases
      console.log('WebSocket server ready');
    },
  },
});

const { app, server, wss } = await app.start();

// Broadcast to all connected clients
wss.clients.forEach((client) => {
  client.send(JSON.stringify({ type: 'broadcast', data: 'Hello everyone!' }));
});
```

### Graceful Shutdown

```typescript
const app = TerrenoApp.create({
  auth: { ... },
  shutdown: {
    handleSignals: true,       // Auto-handle SIGTERM/SIGINT (default: true)
    timeout: 30000,            // 30 second timeout for graceful shutdown

    onShutdown: async () => {
      // Cleanup before shutdown
      await mongoose.disconnect();
      await redis.quit();
      await closeSomeConnections();
    },
  },
});

await app.start();

// Can also trigger shutdown programmatically
process.on('custom-shutdown-event', async () => {
  await app.shutdown();
});
```

When `handleSignals` is true (default), TerrenoApp will:
1. Stop accepting new connections
2. Wait for existing requests to complete (up to `timeout`)
3. Close WebSocket connections gracefully
4. Call `onShutdown` hook
5. Exit process

### Disabling Features

```typescript
const app = TerrenoApp.create({
  auth: {
    userModel: User,
    token: { ... },
    enableAuthRoutes: false,  // Don't add /auth/* routes
    enableMeRoute: false,     // Don't add /me route
  },
  middleware: {
    cors: false,              // Disable CORS entirely
  },
  logging: {
    requests: {
      enabled: false,         // Disable request logging
    },
  },
  openApi: {
    enabled: false,           // Disable OpenAPI generation
  },
  health: {
    enabled: false,           // Disable health endpoint
  },
});
```

### Testing Setup

```typescript
// In tests
const app = TerrenoApp.create({
  auth: { ... },
  server: {
    skipListen: true,  // Don't start HTTP server
  },
  logging: {
    requests: { enabled: false },
  },
});

const expressApp = app.build();  // Get Express app without listening
// Use with supertest
```

---

## Implementation Tasks

### Phase 1: Core Infrastructure

1. **Create `TerrenoAppOptions.ts`**
   - Define all option interfaces with JSDoc comments
   - Create default values factory function
   - Add option validation function

2. **Create `TerrenoAppHooks.ts`**
   - Define hook interfaces
   - Create hook runner utility that handles async hooks
   - Add error handling for hook failures

3. **Create `TerrenoAppMiddleware.ts`**
   - Extract middleware configuration from `expressServer.ts`
   - Create middleware factory functions for each built-in middleware
   - Support enable/disable pattern

### Phase 2: TerrenoApp Class

4. **Create `TerrenoApp.ts`**
   - Implement static `create()` factory
   - Implement `addModelRouter()` with path tracking
   - Implement `addRoute()` with callback and router support
   - Implement `addMiddleware()` with position options
   - Implement `build()` method that orchestrates setup
   - Implement `start()` method that calls build + listen

5. **Implement initialization sequence in `build()`**
   - Express app creation + `onAppCreated` hook
   - Core middleware + `onCoreMiddlewareReady` hook
   - Auth setup + `onAuthReady` hook
   - Health route registration
   - OpenAPI middleware
   - Model routers (in order added)
   - Custom routes (in order added)
   - `onRoutesReady` hook
   - Error handlers
   - `onReady` hook

6. **Implement health endpoint**
   - Create health route handler
   - Support custom health check function
   - Return appropriate status codes (200 healthy, 503 unhealthy)

### Phase 3: Request Lifecycle Hooks

7. **Add request lifecycle middleware**
   - Create middleware for `onRequest` hook
   - Create middleware for `onAuthenticated` hook (after auth)
   - Create response interceptor for `onResponse` hook
   - Integrate `onError` hook into error handlers

### Phase 3.5: WebSocket & Shutdown

8. **Implement WebSocket support**
   - Add optional `ws` dependency
   - Create WebSocket server attached to HTTP server
   - Implement authentication for WebSocket connections
   - Wire up onConnection, onMessage, onClose, onError callbacks
   - Add `onWebSocketReady` hook
   - Expose `getWebSocketServer()` accessor

9. **Implement graceful shutdown**
   - Add SIGTERM/SIGINT handlers (when `handleSignals: true`)
   - Track active connections for graceful drain
   - Implement shutdown timeout with force-close fallback
   - Close WebSocket connections gracefully
   - Call `onShutdown` hook
   - Expose `shutdown()` method for programmatic shutdown

### Phase 4: Integration

10. **Deprecate `expressServer.ts`**
    - Add `@deprecated` JSDoc to `setupServer` and related exports
    - Leave implementation untouched (no refactoring)
    - Will be removed in a future major version

11. **Update exports in `index.ts`**
    - Export TerrenoApp class as primary API
    - Export all option types
    - Keep setupServer export with deprecation warning

### Phase 5: Testing & Documentation

12. **Write tests**
    - Unit tests for option validation
    - Integration tests for middleware toggling
    - Integration tests for hooks execution order
    - Integration tests for health endpoint
    - Integration tests for WebSocket connections
    - Integration tests for graceful shutdown

13. **Update example-backend**
    - Create parallel implementation using TerrenoApp
    - Demonstrate all major features including WebSocket

---

## Migration Guide (for users)

### From setupServer to TerrenoApp

**Before:**
```typescript
import { setupServer } from '@terreno/api';

// Environment variables required:
// TOKEN_ISSUER, TOKEN_SECRET, REFRESH_TOKEN_SECRET, SESSION_SECRET

const app = await setupServer({
  userModel: User,
  corsOrigin: 'https://myapp.com',
  loggingOptions: {
    logSlowRequests: true,
    logSlowRequestsReadMs: 200,
  },
  addRoutes: (app) => {
    app.use('/posts', postRouter);
  },
  addMiddleware: (app) => {
    app.use(customMiddleware);
  },
});
```

**After:**
```typescript
import { TerrenoApp } from '@terreno/api';

const app = TerrenoApp.create({
  auth: {
    userModel: User,
    token: {
      issuer: process.env.TOKEN_ISSUER!,
      secret: process.env.TOKEN_SECRET!,
    },
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_SECRET!,
    },
    session: {
      secret: process.env.SESSION_SECRET!,
    },
  },
  middleware: {
    cors: {
      origin: 'https://myapp.com',
    },
  },
  logging: {
    slowRequests: {
      enabled: true,
      readThresholdMs: 200,
    },
  },
  hooks: {
    onCoreMiddlewareReady: (app) => {
      app.use(customMiddleware);
    },
  },
})
  .addRoute('/posts', postRouter);

await app.start();
```

---

## Breaking Changes

This is a **breaking change** release. Users must migrate from `setupServer` to `TerrenoApp`.

### What's Changing

1. **`setupServer` deprecated** - Marked deprecated, will be removed in next major version
2. **Environment variables no longer used** - All configuration via options (no fallback to env vars)
3. **`modelRouter` unchanged** - Same signature and options, works with TerrenoApp
4. **New primary API** - `TerrenoApp.create()` replaces `setupServer()`

### Migration Required

All users must update their server initialization code. See the Migration Guide section above for before/after examples.

---

## Success Criteria

- [ ] All existing `setupServer` functionality available via `TerrenoApp`
- [ ] Every built-in middleware can be toggled on/off
- [ ] All configuration via options, no required environment variables
- [ ] Health endpoint with custom check support
- [ ] Hooks at every meaningful lifecycle point
- [ ] Fluent API for adding routes and model routers
- [ ] ModelRouter shorthand for permissions-only configuration
- [ ] WebSocket support with authentication
- [ ] Graceful shutdown with signal handling
- [ ] Full TypeScript types with JSDoc documentation
- [ ] Integration tests passing
- [ ] Example app updated to demonstrate new API
