---
description: '@terreno/admin-backend - Admin panel backend plugin'
applyTo: '**/*'
---
# @terreno/admin-backend

Backend plugin for `@terreno/api` that provides automatic admin panel functionality. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### File Structure

```
src/
  adminApp.ts            # AdminApp plugin class
  index.ts               # Package exports
```

## AdminApp Plugin

Implements `TerrenoPlugin` pattern with `register(app: express.Application)` method.

### Configuration

```typescript
import {AdminApp} from "@terreno/admin-backend";

new AdminApp({
  models: [
    {
      model: Todo,                    // Mongoose model
      routePath: "/todos",            // Route path (e.g., /admin/todos)
      displayName: "Todos",           // Human-readable name
      listFields: ["title", "completed", "ownerId", "created"],
      defaultSort: "-created",        // Optional, defaults to "-created"
    },
  ],
  basePath: "/admin",                 // Optional, defaults to "/admin"
}).register(app);
```

### Generated Endpoints

#### GET /admin/config

Returns model metadata for all registered models:

```typescript
{
  models: [
    {
      name: "Todo",
      routePath: "/admin/todos",
      displayName: "Todos",
      listFields: ["title", "completed", "ownerId", "created"],
      defaultSort: "-created",
      fields: {
        title: {type: "string", required: true, description: "..."},
        completed: {type: "boolean", required: false, default: false},
        ownerId: {type: "string", required: true, ref: "User"},
      }
    }
  ]
}
```

#### CRUD Routes

For each model, mounts `modelRouter` with admin-only permissions:

- `GET /admin/{routePath}` — List with pagination
- `POST /admin/{routePath}` — Create
- `GET /admin/{routePath}/:id` — Read
- `PATCH /admin/{routePath}/:id` — Update
- `DELETE /admin/{routePath}/:id` — Delete

All routes require `Permissions.IsAdmin` (user must have `admin: true`).

## Field Metadata Extraction

Uses `getOpenApiSpecForModel()` from `@terreno/api` to extract field information:

- **Type**: Derived from Mongoose schema types
- **Required**: From schema validation rules
- **Description**: From field `description` property (always include descriptions)
- **Enum**: From schema enum arrays
- **Default**: Schema default values
- **Ref**: Relationship references (extracted from schema path options)

## Integration Pattern

```typescript
// In your server setup
import {setupServer} from "@terreno/api";
import {AdminApp} from "@terreno/admin-backend";

const app = setupServer({
  userModel: User,
  addRoutes: (router, options) => {
    // Your other routes
  },
});

// Register admin plugin AFTER setupServer
new AdminApp({
  models: [...],
}).register(app);
```

## Conventions

- Use TypeScript with ES modules
- Prefer const arrow functions
- Named exports preferred
- Follow @terreno/api conventions for error handling and logging
- All admin routes require `IsAdmin` permission
- Model field descriptions are mandatory (flow through to OpenAPI spec)

## Related Packages

- `@terreno/api` - Core API framework (required peer dependency)
- `@terreno/admin-frontend` - React Native admin UI components
