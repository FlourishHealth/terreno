# @terreno/admin-backend

Backend plugin that auto-generates admin CRUD endpoints for Mongoose models. Works with `@terreno/admin-frontend` to provide a complete admin panel solution.

Screens, sidebar, and host wiring: [How admin interfaces are shaped](../explanation/admin-interface.md)
and [Build admin screens](../how-to/build-admin-screens.md).

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
- All routes protected with `Permissions.IsAdmin`, or fine-grained RBAC when `accessControl` is set

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
- `type` — Field type (string, number, boolean, date, objectid, array, etc.)
- `required` — Whether field is required
- `description` — From schema (ensure all fields have descriptions!)
- `enum` — Enum values if applicable
- `default` — Default value
- `ref` — Referenced model name for ObjectId refs

Field metadata is built from `describeModel()` via `modelDescriptionToAdminFields()` — not from a second OpenAPI property walk. Widget overrides (`fieldOverrides`) remain admin-backend configuration.

## Permissions

`admin:access` is the only permission that opens the admin page. `GET /admin/config` returns 403
without it. Script, configuration, RBAC, and per-model permissions never grant entry on their own.

Without `accessControl`, that same page gate uses `Permissions.IsAdmin` (`user.admin`).

With `accessControl`, each model can use a standard admin resource with three actions:

| Action | Access |
| --- | --- |
| `read` | List, search, and read any record |
| `write` | Create, update, bulk-update, and delete any record |
| `writeOwned` | Create records and update/delete records accepted by the ownership helper |

Declare an `admin<ModelName>` statement and optionally customize ownership:

```typescript
import {ADMIN_MODEL_ACCESS} from "@terreno/api";
import {adminOwnedBy, AdminApp} from "@terreno/admin-backend";

const statements = {
  adminForm: ADMIN_MODEL_ACCESS,
  adminScreen: ["formReports"],
} as const;

modelRouter("/forms", Form, {
  admin: {
    adminAccess: {isOwned: adminOwnedBy("staffId")},
    displayName: "Forms",
    listFields: ["title", "staffId"],
  },
  // ...
});

new AdminApp({
  accessControl,
  customScreens: [{
    adminAccess: {resource: "adminScreen", action: "formReports"},
    displayName: "Form reports",
    name: "form-reports",
  }],
});
```

`adminAccess.resource` overrides the default `admin<ModelName>` name. Use
`adminAccess.authorize({action, instance, user})` when a model or screen needs a completely
custom decision. The callback replaces the standard read/write/write-owned decision, while
`admin:access` still protects the admin shell. Every action is authorized without an instance
first (router and `/admin/config` probes). Return `true` for `read` / `update` / `delete` when
`instance` is missing if some records may be allowed; the loaded record is authorized next.
`create` is also checked again with the request body.

`writeOwned` can create any new record; `isOwned` is only applied to update and delete.

The config endpoint is caller-specific: models and custom screens without read access are omitted,
writable controls are disabled, and `platformTools` reports visibility for Scripts, Roles, Version,
and Configuration. Built-in tools use the existing editable permissions:

- Scripts: `admin:runScripts` or `admin:viewBackgroundTasks`
- Roles: `rbac:read`
- Version and Configuration: `configuration:read`
- Audit Log and Feature Flags: their model's admin `read` permission

Read and list responses include `_adminCapabilities.update` and
`_adminCapabilities.delete` for each record. This keeps `writeOwned` forms and row controls
read-only for records the current user does not own. Script metadata separately exposes run and
history permissions so a history-only role never receives an enabled Run control.

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
