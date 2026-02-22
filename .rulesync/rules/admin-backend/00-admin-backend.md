---
description: '@terreno/admin-backend - Admin panel backend plugin for @terreno/api'
applyTo: '**/*'
---
# @terreno/admin-backend

Admin panel backend plugin for @terreno/api that auto-generates CRUD endpoints with metadata for admin interfaces. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Purpose

Provides Express middleware that exposes admin-friendly metadata endpoints for Mongoose models. Works in tandem with @terreno/admin-frontend to build full-featured admin panels without custom code.

## Key Exports

### AdminApp

```typescript
import {AdminApp} from "@terreno/admin-backend";

const adminApp = new AdminApp({
  basePath: "/admin",  // Default: /admin
  models: [
    {
      model: User,
      routePath: "users",
      displayName: "Users",
      listFields: ["email", "name", "created"],
      defaultSort: "-created",
    },
    {
      model: Todo,
      routePath: "todos",
      displayName: "Todos",
      listFields: ["title", "completed", "ownerId"],
      defaultSort: "-created",
    },
  ],
});

// Register with Express app (after auth setup)
adminApp.register(app);
```

### Generated Endpoints

- `GET /admin/config` — Returns model metadata (fields, types, required, enum values, references) extracted from OpenAPI schemas
- Model CRUD routes are created via `modelRouter` with `IsAdmin` permission

### AdminModelConfig

```typescript
interface AdminModelConfig {
  model: Model<any>;           // Mongoose model
  routePath: string;           // URL path segment (e.g., "users")
  displayName: string;         // Human-readable name
  listFields: string[];        // Fields to show in list view
  defaultSort?: string;        // Default sort (e.g., "-created")
}
```

## Integration with @terreno/api

AdminApp is a TerrenoPlugin that registers routes via the `register(app)` method. It uses:
- `getOpenApiSpecForModel()` to extract field metadata
- `modelRouter()` to create standard CRUD endpoints with admin-only permissions
- Mongoose schema introspection for field types, required flags, enums, and references

## Conventions

- All admin routes require `IsAdmin` permission
- Admin routes are namespaced under `/admin` by default (configurable via `basePath`)
- Field metadata is derived from Mongoose schemas via OpenAPI introspection
- Use with @terreno/admin-frontend for a complete admin interface
