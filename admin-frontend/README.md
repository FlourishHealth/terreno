# @terreno/admin-frontend

React Native admin panel UI components for `@terreno/api` backends. Provides dynamic screens that automatically generate DataTables, forms, and list views from backend model metadata.

## Features

- **Dynamic Screen Components**: Auto-generated UI based on OpenAPI model schemas
- **Full CRUD Operations**: List, create, read, update, and delete with RTK Query hooks
- **Type-Safe Forms**: Field type mapping to appropriate UI components
- **Relationship Support**: SelectField for ObjectId references with auto-fetch
- **Data Tables**: Pagination, sorting, and date formatting (via Luxon)
- **Expo Router Compatible**: Drop-in screens for Expo Router navigation

## Installation

``````bash
bun add @terreno/admin-frontend
``````

**Peer Dependencies**: `react`, `react-redux`, `@reduxjs/toolkit`

## Usage

### Basic Setup

Register your admin backend with `@terreno/admin-backend`, then use the frontend components:

``````typescript
import {AdminModelList, AdminModelTable, AdminModelForm} from "@terreno/admin-frontend";
import {terrenoApi} from "@/store/sdk";

// List view - shows all registered models as cards
<AdminModelList baseUrl="/admin" api={terrenoApi} />

// Table view - paginated DataTable for a specific model
<AdminModelTable 
  baseUrl="/admin" 
  api={terrenoApi} 
  modelName="Todo" 
/>

// Form view - create or edit a model instance
<AdminModelForm 
  baseUrl="/admin"
  api={terrenoApi}
  modelName="Todo"
  mode="create"
/>

<AdminModelForm 
  baseUrl="/admin"
  api={terrenoApi}
  modelName="Todo"
  mode="edit"
  itemId="507f1f77bcf86cd799439011"
/>
``````

### Expo Router Integration

Create admin screens in your Expo Router app:

``````typescript
// app/admin/index.tsx - Model list
import {AdminModelList} from "@terreno/admin-frontend";
import {terrenoApi} from "@/store/sdk";

export default function AdminScreen() {
  return <AdminModelList baseUrl="/admin" api={terrenoApi} />;
}

// app/admin/[model]/index.tsx - Model table
import {AdminModelTable} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import {terrenoApi} from "@/store/sdk";

export default function AdminModelScreen() {
  const {model} = useLocalSearchParams<{model: string}>();
  return <AdminModelTable baseUrl="/admin" api={terrenoApi} modelName={model} />;
}

// app/admin/[model]/create.tsx - Create form
import {AdminModelForm} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import {terrenoApi} from "@/store/sdk";

export default function AdminCreateScreen() {
  const {model} = useLocalSearchParams<{model: string}>();
  return <AdminModelForm baseUrl="/admin" api={terrenoApi} modelName={model} mode="create" />;
}

// app/admin/[model]/[id].tsx - Edit form
import {AdminModelForm} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import {terrenoApi} from "@/store/sdk";

export default function AdminEditScreen() {
  const {model, id} = useLocalSearchParams<{model: string; id: string}>();
  return <AdminModelForm baseUrl="/admin" api={terrenoApi} modelName={model} mode="edit" itemId={id} />;
}
``````

## Components

### AdminModelList

Grid of cards showing all registered models.

**Props:**
- `baseUrl` (string, required) - Admin base URL (e.g., `/admin`)
- `api` (RTK Query API, required) - Redux Toolkit Query API instance

**Features:**
- Auto-fetches model config from `GET {baseUrl}/config`
- Card navigation to model tables
- Loading and error states

### AdminModelTable

DataTable view with pagination and sorting.

**Props:**
- `baseUrl` (string, required) - Admin base URL
- `api` (RTK Query API, required) - RTK Query API instance
- `modelName` (string, required) - Model name (e.g., `"Todo"`)

**Features:**
- Paginated list with configurable page size
- Column sorting
- Date field formatting (ISO → human-readable via Luxon)
- Row click navigation to edit form
- Create button in header
- Loading skeleton and empty states

### AdminModelForm

Dynamic create/edit form with validation.

**Props:**
- `baseUrl` (string, required) - Admin base URL
- `api` (RTK Query API, required) - RTK Query API instance
- `modelName` (string, required) - Model name
- `mode` (`"create" | "edit"`, required) - Form mode
- `itemId` (string, optional) - Item ID for edit mode

**Features:**
- Field type mapping (see Field Renderer section)
- Required field validation
- Default values in create mode
- Delete with confirmation modal (edit mode only)
- Auto-navigation after save/delete
- Toast notifications for errors

### AdminFieldRenderer

Maps OpenAPI field types to `@terreno/ui` form components.

**Type Mapping:**

| OpenAPI Type | UI Component | Notes |
|-------------|-------------|-------|
| `boolean` | `BooleanField` | Checkbox |
| `string` (enum) | `SelectField` | Dropdown with enum options |
| `string` (ref) | `AdminRefField` | Related model selector |
| `string` (date/time) | `DateTimeField` | ISO string with date picker |
| `number`, `integer` | `NumberField` | Numeric input |
| `string` (default) | `TextField` | Text input |

### AdminRefField

SelectField for ObjectId references that fetches related items.

**Features:**
- Auto-fetches first 100 items from referenced model
- Uses `displayName` or fallback fields for labels
- Shows loading state while fetching
- Handles missing/invalid references

## Hooks

### useAdminConfig

Fetches admin configuration from backend.

``````typescript
import {useAdminConfig} from "@terreno/admin-frontend";

const {config, isLoading, error} = useAdminConfig(api, "/admin");
// config.models: AdminModelConfig[]
``````

### useAdminApi

Dynamically injects RTK Query endpoints for a model.

``````typescript
import {useAdminApi} from "@terreno/admin-frontend";

const {
  useListQuery,
  useReadQuery,
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
} = useAdminApi(api, "/admin/todos", "Todo");

const {data, isLoading} = useListQuery({page: 1, limit: 20});
const [createTodo] = useCreateMutation();
``````

## Configuration

Admin configuration is fetched from `GET {baseUrl}/config`. Expected response:

``````typescript
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
``````

## Styling

All components use `@terreno/ui` primitives:
- `Box` for layout
- `Page` for screen structure
- `Card` for model cards
- `DataTable` for lists
- `TextField`, `BooleanField`, `SelectField`, `DateTimeField`, `NumberField` for forms
- `Button` for actions
- `Modal` for confirmations
- `Toast` for notifications

Customize via `TerrenoProvider` theme configuration.

## System Fields

These fields are automatically excluded from forms:
- `_id`, `id`, `__v`
- `created`, `updated`, `deleted` (timestamps)

## Permissions

Admin operations require `IsAdmin` permission on the backend. Frontend components display error messages for 401/403 responses.

## Example

See `example-frontend/app/admin/` for complete Expo Router integration.

## Related Packages

- `@terreno/admin-backend` - Backend plugin (required)
- `@terreno/ui` - UI component library (required)
- `@terreno/rtk` - RTK Query utilities (required)

## License

Apache-2.0
