# @terreno/admin-backend

Backend plugin that auto-generates admin CRUD endpoints for Mongoose models. Works with `@terreno/admin-frontend` to provide a complete admin panel solution.

## Quick Start

``````typescript
import {AdminApp} from "@terreno/admin-backend";
import {User, Todo} from "./models";

const admin = new AdminApp({
  basePath: "/admin",
  models: [
    {
      model: User,
      routePath: "/users",
      displayName: "Users",
      listFields: ["email", "name", "admin"],
      defaultSort: "-created",
    },
    {
      model: Todo,
      routePath: "/todos",
      displayName: "Todos",
      listFields: ["title", "completed", "ownerId"],
    },
  ],
});

admin.register(app);
``````

This creates:
- `GET /admin/config` — Model metadata endpoint
- Standard CRUD routes for each model at `{basePath}{routePath}`
- All routes protected with `Permissions.IsAdmin`

## AdminApp Options

``````typescript
interface AdminOptions {
  models: AdminModelConfig[];
  basePath?: string;  // Default: "/admin"
}

interface AdminModelConfig {
  model: Model<any>;
  routePath: string;      // e.g., "/users"
  displayName: string;    // e.g., "Users"
  listFields: string[];   // Fields shown in table
  defaultSort?: string;   // Default: "-created"
}
``````

## Generated Routes

For each model, creates standard modelRouter CRUD endpoints:

- `GET {basePath}{routePath}` — List (paginated, sortable)
- `POST {basePath}{routePath}` — Create
- `GET {basePath}{routePath}/:id` — Read
- `PATCH {basePath}{routePath}/:id` — Update
- `DELETE {basePath}{routePath}/:id` — Delete

## Config Endpoint

`GET {basePath}/config` returns metadata for all registered models:

``````typescript
{
  models: [
    {
      name: "User",
      routePath: "/admin/users",
      displayName: "Users",
      listFields: ["email", "name", "admin"],
      defaultSort: "-created",
      fields: {
        email: {
          type: "string",
          required: true,
          description: "User email address"
        },
        admin: {
          type: "boolean",
          required: false,
          default: false
        }
      }
    }
  ]
}
``````

Field metadata includes:
- `type` — Field type (string, number, boolean, date, objectid, etc.)
- `required` — Whether field is required
- `description` — From schema (ensure all fields have descriptions!)
- `enum` — Enum values if applicable
- `default` — Default value
- `ref` — Referenced model name for ObjectId refs

## Permissions

All admin routes use `Permissions.IsAdmin`, which checks `user.admin === true`.

**Important:** Only expose models that should be editable via admin panel. Avoid sensitive internal models.

## Best Practices

- Add `description` to all model fields — flows through to admin UI
- Use `listFields` to control which columns appear in table views
- Set `defaultSort` to control initial ordering (usually `"-created"`)
- Keep `routePath` simple and pluralized (`"/users"`, `"/todos"`)

## Integration

Works seamlessly with `@terreno/admin-frontend`. The frontend uses the `/admin/config` endpoint to:
- Discover available models
- Generate forms with proper field types
- Render references as clickable links
- Validate required fields
