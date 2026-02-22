# @terreno/admin-backend

Backend plugin for `@terreno/api` that provides automatic admin panel functionality. Exposes model metadata via REST API and mounts admin-only CRUD routes for registered Mongoose models.

## Features

- **Model Metadata Endpoint**: `GET /admin/config` returns field types, validation rules, relationships, and display configuration
- **Admin-Only CRUD Routes**: Automatic REST endpoints with `IsAdmin` permission guards
- **OpenAPI Integration**: Field metadata extracted from Mongoose schemas using `getOpenApiSpecForModel`
- **Plugin Architecture**: Implements `TerrenoPlugin` pattern for clean integration with `setupServer`

## Installation

```bash
bun add @terreno/admin-backend
```

## Usage

### Basic Setup

Register the `AdminApp` plugin in your server setup:

``````typescript
import {setupServer} from "@terreno/api";
import {AdminApp} from "@terreno/admin-backend";
import {User, Todo} from "./models";

const app = setupServer({
  userModel: User,
  addRoutes: (router, options) => {
    // Your other routes
  },
});

new AdminApp({
  models: [
    {
      model: Todo,
      routePath: "/todos",
      displayName: "Todos",
      listFields: ["title", "completed", "ownerId", "created"],
      defaultSort: "-created",
    },
    {
      model: User,
      routePath: "/users",
      displayName: "Users",
      listFields: ["email", "name", "admin", "created"],
    },
  ],
}).register(app);
``````

### Configuration Options

#### AdminApp Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `models` | `AdminModelConfig[]` | Yes | - | Array of models to expose in admin panel |
| `basePath` | `string` | No | `/admin` | Base path for all admin routes |

#### AdminModelConfig

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `model` | `Model<any>` | Yes | - | Mongoose model to expose |
| `routePath` | `string` | Yes | - | Route path (e.g., `/todos`) |
| `displayName` | `string` | Yes | - | Human-readable name for UI |
| `listFields` | `string[]` | Yes | - | Fields to show in list view |
| `defaultSort` | `string` | No | `-created` | Default sort order |

### Generated Endpoints

#### Configuration Endpoint

**GET /admin/config**

Returns metadata for all registered models:

``````json
{
  "models": [
    {
      "name": "Todo",
      "routePath": "/admin/todos",
      "displayName": "Todos",
      "listFields": ["title", "completed", "ownerId", "created"],
      "defaultSort": "-created",
      "fields": {
        "title": {
          "type": "string",
          "required": true,
          "description": "The title of the todo item"
        },
        "completed": {
          "type": "boolean",
          "required": false,
          "default": false,
          "description": "Whether the todo item has been completed"
        },
        "ownerId": {
          "type": "string",
          "required": true,
          "ref": "User",
          "description": "The user who owns this todo"
        }
      }
    }
  ]
}
``````

#### CRUD Endpoints

For each registered model, the following endpoints are created with `IsAdmin` permissions:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/{routePath}` | List items with pagination |
| POST | `/admin/{routePath}` | Create new item |
| GET | `/admin/{routePath}/:id` | Get single item |
| PATCH | `/admin/{routePath}/:id` | Update item |
| DELETE | `/admin/{routePath}/:id` | Delete item |

## Field Metadata

Field metadata is automatically extracted from Mongoose schemas:

- **Type**: Mapped from Mongoose schema types (String → "string", Boolean → "boolean", ObjectId → "string")
- **Required**: Derived from schema validation rules
- **Description**: Pulled from field `description` property (always use descriptions on model fields)
- **Enum**: Extracted from schema enum arrays
- **Default**: Schema default values
- **Ref**: Relationship references extracted from schema path options

## Permissions

All admin endpoints require the user to have `admin: true` in their user document. Uses `@terreno/api` permission system:

- `Permissions.IsAdmin` applied to all CRUD operations
- Unauthenticated requests return 401
- Non-admin authenticated users return 403

## Integration with Frontend

Pair with `@terreno/admin-frontend` for a complete admin panel solution:

``````typescript
// Backend
new AdminApp({models: [...]}).register(app);

// Frontend (see @terreno/admin-frontend docs)
import {AdminModelList, AdminModelTable, AdminModelForm} from "@terreno/admin-frontend";
``````

## Example

See `example-backend/src/server.ts` for a complete working example with Todo and User models.

## Related Packages

- `@terreno/api` - Core API framework (required peer dependency)
- `@terreno/admin-frontend` - React Native admin UI components

## License

Apache-2.0
