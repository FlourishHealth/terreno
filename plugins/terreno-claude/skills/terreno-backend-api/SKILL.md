---
name: terreno-backend-api
description: >-
  Guidelines for creating backend APIs with @terreno/api on Express/Mongoose.
  Covers when to use Terreno backend vs Expo API routes, modelRouter CRUD,
  permissions, custom routes, OpenAPI generation, and the SDK codegen pipeline.
  Use when adding models, routes, auth, or server-side logic in Terreno apps.
  Lifecycle composition: Grow for API shape, Pick for implementation, Roast for
  API/integration proof.
---
# Terreno Backend API

Use this skill when building server-side APIs for Terreno apps. Terreno uses **Express + Mongoose** (`@terreno/api`), not Expo API routes (`+api.ts` on EAS Hosting).

**Related skills:** `mongoose-schema-safety` (schema changes), `generate-sdk` (frontend hooks after API changes), `terreno-data-fetching` (consuming the API), `backend-test-env` (tests that mutate env).

## Documentation

1. Read `docs/reference/api.md` and the relevant how-to/explanation pages before changing routes, models, or permissions.
2. Implement against that design.
3. Update those pages in the same slice with `update-docs` (Diátaxis: tutorial / how-to / reference / explanation).
4. Ship without matching docs is a failed slice.

## Terreno vs Expo API Routes

| Need | Use |
|------|-----|
| MongoDB CRUD with auth/permissions | `@terreno/api` `modelRouter` on Express |
| JWT auth, admin panel, realtime | `@terreno/api` (built-in) |
| Server secrets, webhooks, heavy compute | `@terreno/api` Express backend |
| Edge functions, no MongoDB, Cloudflare Workers | Expo API routes (see `expo-api-routes` skill) |
| Managed backend (Firebase, Supabase) | Not Terreno — use those platforms directly |

**Default for Terreno apps:** Express backend with `TerrenoApp` or `setupServer`, MongoDB, and OpenAPI-generated SDK.

## References

```
references/
  model-router.md        CRUD generation, permissions, hooks, actions
  custom-routes.md       Non-CRUD endpoints with createOpenApiBuilder
  server-setup.md        TerrenoApp, env vars, MongoDB, testing
```

## Quick Start — New CRUD Resource

### 1. Define the Mongoose model

```typescript
// src/models/todo.ts
import mongoose from "mongoose";
import {addDefaultPlugins} from "./modelPlugins";
import type {TodoDocument, TodoModel} from "../types/models/todoTypes";

const todoSchema = new mongoose.Schema<TodoDocument, TodoModel>(
  {
    title: {
      description: "The title of the todo item",
      required: true,
      trim: true,
      type: String,
    },
    completed: {
      default: false,
      description: "Whether the todo item has been completed",
      type: Boolean,
    },
    ownerId: {
      description: "The user who owns this todo",
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}},
);

todoSchema.plugin(addDefaultPlugins);

export const Todo = mongoose.model<TodoDocument, TodoModel>("Todo", todoSchema);
```

Every field needs a `description`. See `mongoose-schema-safety` skill.

### 2. Register modelRouter

`modelRouter` has two signatures — use the one that matches your server setup:

```typescript
// TerrenoApp (recommended): path is the first argument; returns a registration object
export const todoRouter = modelRouter("/todos", Todo, options);
app.register(todoRouter);

// setupServer (legacy): path is passed to router.use(); returns an Express router
router.use("/todos", modelRouter(Todo, options));
```

Example with full options:

```typescript
// src/api/todos.ts
import {modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {Todo} from "../models/todo";
import type {UserDocument} from "../types/models/userTypes";

export const todoRouter = modelRouter("/todos", Todo, {
  permissions: {
    create: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsOwner],
    update: [Permissions.IsOwner],
    delete: [Permissions.IsOwner],
  },
  preCreate: (body, req) => ({
    ...body,
    ownerId: (req.user as unknown as UserDocument)?._id,
  }),
  queryFilter: OwnerQueryFilter,
  queryFields: ["completed", "ownerId"],
  sort: "-created",
});
```

### 3. Register with TerrenoApp

```typescript
// src/server.ts
import {TerrenoApp} from "@terreno/api";
import {User} from "./models/user";
import {todoRouter} from "./api/todos";

const app = new TerrenoApp({userModel: User})
  .register(todoRouter)
  .start();
```

### 4. Regenerate frontend SDK

```bash
cd example-frontend && bun run sdk
```

See `generate-sdk` skill.

## Generated Endpoints

`modelRouter` creates:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/todos` | Create |
| GET | `/todos` | List (paginated) |
| GET | `/todos/:id` | Read |
| PATCH | `/todos/:id` | Update |
| DELETE | `/todos/:id` | Delete |

List responses: `{data, page, limit, total, more}`.

Disable a method with `permissions: {delete: []}`.

## Error Handling

```typescript
import {APIError} from "@terreno/api";

throw new APIError({status: 400, title: "Title is required"});
throw new APIError({
  status: 400,
  title: "Validation failed",
  fields: {email: "Email is required"},
});
```

## Permissions

| Permission | Checks |
|------------|--------|
| `IsAuthenticated` | Logged in, non-anonymous |
| `IsOwner` | Admin or `obj.ownerId === user.id` |
| `IsAdmin` | `user.admin === true` |
| `IsAuthenticatedOrReadOnly` | Auth for writes, anyone for reads |

All permissions in the array must pass (AND logic).

## Custom Routes

For non-CRUD endpoints, use `createOpenApiBuilder`:

```typescript
import {asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";

router.get("/stats", [
  authenticateMiddleware(),
  createOpenApiBuilder(options)
    .withTags(["stats"])
    .withSummary("Get statistics")
    .withResponse(200, {count: {type: "number"}})
    .build(),
], asyncHandler(async (req, res) => {
  return res.json({data: {count: 42}});
}));
```

See `./references/custom-routes.md`.

## Admin Panel

```typescript
import {AdminApp} from "@terreno/admin-backend";

const admin = new AdminApp({
  models: [{
    model: Todo,
    routePath: "/todos",
    displayName: "Todos",
    listFields: ["title", "completed", "ownerId"],
  }],
});
admin.register(app);
```

Pairs with `@terreno/admin-frontend` on the Expo side.

## Decision Tree

```
Need server-side logic?
  |-- CRUD on a MongoDB model?
  |   \-- modelRouter (references/model-router.md)
  |
  |-- One-off endpoint (stats, webhook, action)?
  |   \-- custom-routes.md (createOpenApiBuilder)
  |
  |-- Admin CRUD?
  |   \-- AdminApp + admin-frontend
  |
  |-- AI/GPT features?
  |   \-- @terreno/ai (AIService, addGptRoutes)
  |
  |-- Schema change?
  |   \-- mongoose-schema-safety, then generate-sdk
  |
  |-- Edge function without MongoDB?
  |   \-- expo-api-routes skill (not Terreno default)
  |
  \-- Frontend needs new hooks?
      \-- generate-sdk
```

## Database seeds

Use `runSeedCli` with ordered `SeedStep` definitions for development and test
data. Default sync runs should use `context.upsert()` with stable business keys;
put destructive cleanup in each step's `reset` handler. The generated CLI
supports `--dry-run`, `--only`, and `--reset`. Production resets additionally
require `--force` plus an approving `allowProductionReset` option.

See `docs/how-to/seed-a-database.md`.

## Testing

```bash
bun run api:test          # @terreno/api package tests
cd example-backend && bun run test
```

- Use `bun test` with `expect`
- Use `supertest` for HTTP
- Never mock `@terreno/api` or models — test real functionality
- See `backend-test-env` skill for env mutation in tests

## Common Mistakes

**Wrong: Model.findOne**

```typescript
const todo = await Todo.findOne({_id: id});
```

**Right: findExactlyOne or findOneOrThrow**

```typescript
const todo = await Todo.findExactlyOne({_id: id});
```

**Wrong: Expo API route for MongoDB CRUD**

```typescript
// app/api/todos+api.ts with Turso/D1
```

**Right: modelRouter on Express**

```typescript
export const todoRouter = modelRouter("/todos", Todo, {...});
```

**Wrong: Forgetting SDK regeneration**

After backend changes, always run `generate-sdk`.

## Example Invocations

- "Add a Todo API" → model + modelRouter + TerrenoApp.register + generate-sdk
- "Add a bulk complete endpoint" → `collectionActions` on modelRouter (see example-backend todos)
- "Restrict list to owner" → `queryFilter: OwnerQueryFilter`
- "Add admin CRUD" → AdminApp registration
- "Webhook endpoint" → custom route with createOpenApiBuilder
