---
paths:
  - '**/*'
---
# example-backend

Example Express backend demonstrating @terreno/api usage with Mongoose models, permissions, and OpenAPI generation. This is a **backend-only** app — no React, no UI components, no frontend code.

## Commands

```bash
bun run dev              # Start dev server with watch (port 4000)
bun run start            # Start production server
bun run compile          # Type check
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### File Structure

```
src/
  index.ts               # Entry point (imports instrument, calls start())
  server.ts              # Express setup with setupServer()
  conf.ts                # Configuration management
  models/
    user.ts              # User model with passport-local-mongoose
    todo.ts              # Todo model with ownerId reference
    configuration.ts     # Singleton config model with change streams
    index.ts             # Model exports
    modelPlugins.ts      # Default plugins (timestamps, etc.)
  api/
    users.ts             # User CRUD routes (admin-only)
    todos.ts             # Todo CRUD routes (owner-based)
    health.ts            # Health check endpoint
  types/
    models/
      userTypes.ts       # User Document/Model/Statics interfaces
      todoTypes.ts       # Todo interfaces
      configurationTypes.ts
    modelPlugins.ts      # Plugin types
  services/
    userService.ts       # Business logic
  utils/
    database.ts          # MongoDB connection
    requestMonitor.ts    # Request tracking
```

## Server Setup

```typescript
import {configureOpenApiValidator, setupServer} from "@terreno/api";

// Enable OpenAPI request validation before setupServer
configureOpenApiValidator({
  onAdditionalPropertiesRemoved: (props, req) => {
    Sentry.captureMessage(`Stripped: ${props.join(", ")} on ${req.method} ${req.path}`);
  },
});

setupServer({
  userModel: User,
  addRoutes: (router, options) => {
    addTodoRoutes(router, options);
    addUserRoutes(router, options);
    addHealthRoutes(router, options);
  },
  loggingOptions: {logRequests: true, logSlowRequests: true},
  sentryOptions: {...},
});
```

### Startup Sequence

1. Connect to MongoDB
2. Call `configureOpenApiValidator()` to activate request validation
3. Configure logging (Winston + Google Cloud support)
4. Initialize Sentry
5. Run `checkModelsStrict()` in non-production (validates schema consistency)
6. Set up OpenAPI middleware
7. Start Express server

## Model Patterns

### User Model

```typescript
// Uses passport-local-mongoose plugin for auth
import passportLocalMongoose from "passport-local-mongoose";

const userSchema = new mongoose.Schema<UserDocument, UserModel, UserMethods>({
  email: {type: String, unique: true},
  name: {type: String},
  admin: {type: Boolean, default: false},
});

userSchema.plugin(passportLocalMongoose, {usernameField: "email"});
userSchema.plugin(addDefaultPlugins);

userSchema.methods = {
  getDisplayName(this: UserDocument): string { return this.name || this.email; },
};
userSchema.statics = {
  async findByEmail(this: UserModel, email: string): Promise<UserDocument | null> {...},
};
```

### Todo Model (Owner-based)

```typescript
const todoSchema = new mongoose.Schema<TodoDocument>({
  title: {type: String, required: true},
  completed: {type: Boolean, default: false},
  ownerId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
}, {strict: true, toJSON: {virtuals: true}});

todoSchema.plugin(addDefaultPlugins);
```

### Type Definitions

All types live in `types/models/`:

```typescript
export interface UserDocument extends DefaultDoc, UserMethods {
  email: string;
  name?: string;
  admin: boolean;
}
export interface UserModel extends DefaultModel<UserDocument>, UserStatics {
  createStrategy(): any;
  serializeUser(): any;
  deserializeUser(): any;
}
```

## Route Patterns

### Owner-based CRUD (Todo)

```typescript
export const addTodoRoutes = (router, options?) => {
  router.use("/todos", modelRouter(Todo, {
    ...options,
    permissions: {
      create: [Permissions.IsAuthenticated],
      list: [Permissions.IsAuthenticated],
      read: [Permissions.IsOwner],
      update: [Permissions.IsOwner],
      delete: [Permissions.IsOwner],
    },
    preCreate: (body, req) => ({
      ...body,
      ownerId: (req.user as UserDocument)?._id,
    }),
    queryFilter: OwnerQueryFilter,     // Restricts list to user's own
    queryFields: ["completed", "ownerId"],
    sort: "-created",
    // Enable request validation for all operations
    validation: {
      validateCreate: true,
      validateUpdate: true,
      validateQuery: true,
    },
  }));
};
```

### Admin-only CRUD (User)

```typescript
export const addUserRoutes = (router, options?) => {
  router.use("/users", modelRouter(User, {
    ...options,
    permissions: {
      create: [Permissions.IsAdmin],
      list: [Permissions.IsAdmin],
      read: [Permissions.IsAdmin],
      update: [Permissions.IsAdmin],
      delete: [],  // Disabled
    },
    responseHandler: async (value, method) => {
      // Strip sensitive fields
      const clean = (u) => {const {hash, salt, ...rest} = serialize(u); return rest;};
      return Array.isArray(value) ? value.map(clean) : clean(value);
    },
    queryFields: ["email", "name"],
  }));
};
```

### Custom Endpoints (Health)

```typescript
router.get("/health", [
  createOpenApiBuilder(options)
    .withTags(["health"])
    .withSummary("Health check")
    .withResponse(200, {status: {type: "string"}, timestamp: {type: "string"}})
    .build(),
], asyncHandler(async (req, res) => {
  const userCount = await User.countDocuments();
  return res.json({status: "ok", timestamp: new Date().toISOString(), userCount});
}));
```

## Configuration Model

Singleton pattern for runtime configuration with database persistence and change streams:

```typescript
// Priority: runtime override > database cache > env var > default value
const config = await Configuration.get("FEATURE_FLAG", {default: "false"});
await Configuration.set("FEATURE_FLAG", "true");  // Persists to DB + updates cache
```

## Conventions

- Error handling: `throw new APIError({status: 400, title: "..."})` — check conditions early, return fast
- Mongoose: Use `Model.findExactlyOne` or `Model.findOneOrThrow` — never `Model.findOne`
- Methods: `schema.methods = {...}` and `schema.statics = {...}` (direct assignment)
- User casting: `req.user` is `UserDocument | undefined`, in callbacks cast with `as unknown as UserDocument`
- Logging: Use `logger.info/warn/error/debug` — never `console.log`
- Testing: bun test with expect, supertest for HTTP, manual mocks in `__mocks__/`, never mock @terreno/api
