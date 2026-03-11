---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/admin-frontend - Admin panel frontend screens for @terreno/api backends"
globs: ["**/*"]
---

# @terreno/admin-frontend

Admin panel frontend screens for @terreno/api backends. Provides reusable React Native components for building admin interfaces with CRUD operations. This is a **frontend-only** package — no Express, no Mongoose, no backend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode (TypeScript watch)
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### File Structure

```
src/
  index.tsx              # Package exports
  types.ts               # TypeScript interfaces (AdminModelConfig, AdminFieldConfig, etc.)
  AdminModelList.tsx     # List of all admin models (entry screen)
  AdminModelTable.tsx    # Table view for a specific model (list with pagination)
  AdminModelForm.tsx     # Create/edit form for a model instance
  AdminFieldRenderer.tsx # Renders individual fields in table cells
  AdminRefField.tsx      # Renders reference fields as clickable links
  useAdminConfig.tsx     # Hook to fetch admin config from backend
  useAdminApi.tsx        # Hook to generate RTK Query hooks for admin routes
```

## Key Exports

```typescript
import {
  AdminModelList,        // Model list screen (entry point)
  AdminModelTable,       // Table view for a specific model
  AdminModelForm,        // Create/edit form
  AdminFieldRenderer,    // Field renderer for table cells
  AdminRefField,         // Reference field renderer
  useAdminConfig,        // Hook to fetch admin config
  useAdminApi,           // Hook to generate API hooks
  SYSTEM_FIELDS,         // Fields to skip in forms
} from "@terreno/admin-frontend";
```

## Usage

### Setup in Expo Router

```typescript
// app/admin/_layout.tsx
import {Stack} from "expo-router";

export default function AdminLayout() {
  return <Stack screenOptions={{headerShown: false}} />;
}

// app/admin/index.tsx
import {AdminModelList} from "@terreno/admin-frontend";
import {api} from "@/store/openApiSdk";

export default function AdminIndexScreen() {
  return <AdminModelList baseUrl="/admin" api={api} />;
}

// app/admin/[modelName]/index.tsx
import {AdminModelTable} from "@terreno/admin-frontend";
import {api} from "@/store/openApiSdk";
import {useLocalSearchParams} from "expo-router";

export default function AdminModelScreen() {
  const {modelName} = useLocalSearchParams();
  return <AdminModelTable baseUrl="/admin" api={api} modelName={modelName as string} />;
}

// app/admin/[modelName]/new.tsx and [id].tsx
import {AdminModelForm} from "@terreno/admin-frontend";
import {api} from "@/store/openApiSdk";
import {useLocalSearchParams} from "expo-router";

export default function AdminFormScreen() {
  const {modelName, id} = useLocalSearchParams();
  return <AdminModelForm 
    baseUrl="/admin" 
    api={api} 
    modelName={modelName as string} 
    id={id as string | undefined}
  />;
}
```

## Components

### AdminModelList

Entry point that displays all available admin models as cards.

```typescript
<AdminModelList
  baseUrl="/admin"         // Base URL for admin routes
  api={api}                // RTK Query API instance
/>
```

Features:
- Fetches config from `{baseUrl}/config`
- Displays models as clickable cards
- Shows field count for each model
- Navigates to `{baseUrl}/{modelName}` on click

### AdminModelTable

Table view for a specific model with pagination, sorting, and actions.

```typescript
<AdminModelTable
  baseUrl="/admin"
  api={api}
  modelName="User"
/>
```

Features:
- Uses DataTable from @terreno/ui
- Column headers from `listFields` in backend config
- Click row to edit
- "Create New" button (navigates to `{baseUrl}/{modelName}/new`)
- Pagination controls
- Loading and error states
- Reference fields render as clickable links (via AdminRefField)

### AdminModelForm

Create or edit form for a model instance.

```typescript
<AdminModelForm
  baseUrl="/admin"
  api={api}
  modelName="User"
  id="507f1f77bcf86cd799439011"  // Optional, for edit mode
/>
```

Features:
- Auto-generates fields from model schema
- Skips system fields (_id, __v, created, updated, deleted)
- Field types mapped from schema:
  - `string` → TextField
  - `boolean` → BooleanField
  - `number` → NumberField
  - `date` → DateTimeField
  - `objectid` (ref) → SelectField (fetches options from referenced model)
  - `enum` → SelectField with enum values
- Validates required fields
- Save button (creates or updates)
- Cancel button (navigates back)
- Loading states during save

### AdminFieldRenderer

Renders field values in table cells with appropriate formatting.

```typescript
<AdminFieldRenderer
  value={value}
  field={fieldConfig}
  modelName="User"
  baseUrl="/admin"
/>
```

Handles:
- Booleans → "Yes"/"No" or checkmark icon
- Dates → Formatted with Luxon
- ObjectId refs → Link to referenced model (via AdminRefField)
- Arrays → Comma-separated or count
- Objects → JSON.stringify
- Null/undefined → empty

### AdminRefField

Renders reference fields as clickable links that navigate to the referenced model's detail view.

```typescript
<AdminRefField
  value={userId}           // ObjectId value
  refModel="User"          // Referenced model name
  baseUrl="/admin"
/>
```

## Hooks

### useAdminConfig

Fetches admin configuration from backend.

```typescript
const {config, isLoading, error} = useAdminConfig(api, baseUrl);

// config: AdminConfigResponse | undefined
// {
//   models: [
//     {
//       name: "User",
//       routePath: "/admin/users",
//       displayName: "Users",
//       listFields: ["email", "name", "admin"],
//       defaultSort: "-created",
//       fields: {
//         email: {type: "string", required: true, description: "User email"},
//         name: {type: "string", required: false},
//         admin: {type: "boolean", required: false, default: false},
//       }
//     }
//   ]
// }
```

### useAdminApi

Generates RTK Query hooks for admin CRUD operations on a specific model.

```typescript
const {
  useListQuery,         // GET {baseUrl}{routePath} (list with pagination)
  useGetQuery,          // GET {baseUrl}{routePath}/:id (single item)
  useCreateMutation,    // POST {baseUrl}{routePath} (create)
  useUpdateMutation,    // PATCH {baseUrl}{routePath}/:id (update)
  useDeleteMutation,    // DELETE {baseUrl}{routePath}/:id (delete)
} = useAdminApi(api, baseUrl, modelName);

// Example usage
const {data, isLoading} = useListQuery({limit: 20, page: 1});
const [create, {isLoading: isCreating}] = useCreateMutation();
await create({email: "test@example.com", name: "Test User"}).unwrap();
```

## Types

```typescript
interface AdminFieldConfig {
  type: string;                // Field type
  required: boolean;           // Is field required
  description?: string;        // Field description
  enum?: string[];             // Enum values if applicable
  default?: any;               // Default value
  ref?: string;                // Referenced model name for ObjectId refs
}

interface AdminModelConfig {
  name: string;                // Model name
  routePath: string;           // Full route path
  displayName: string;         // Human-readable name
  listFields: string[];        // Fields to show in table
  defaultSort: string;         // Default sort order
  fields: Record<string, AdminFieldConfig>;  // Field metadata
}

interface AdminConfigResponse {
  models: AdminModelConfig[];
}

interface AdminScreenProps {
  baseUrl: string;             // Base URL for admin routes
  api: Api<any, any, any, any>;  // RTK Query API instance
}
```

## System Fields

Fields that are automatically skipped in forms:

```typescript
export const SYSTEM_FIELDS = new Set([
  "_id",
  "id",
  "__v",
  "created",
  "updated",
  "deleted",
]);
```

## Conventions

- Always use @terreno/ui components (Box, Button, TextField, etc.) — never raw React Native components
- Use functional components with `React.FC` type
- Use generated RTK Query hooks via `useAdminApi` — never use axios directly
- Handle loading, error, and empty states in all screens
- Use `console.info/debug/warn/error` for permanent logs
- Use Luxon for date operations
- Always support React Native Web
- Use inline styles over `StyleSheet.create`

## Integration with @terreno/admin-backend

Frontend expects backend to:
1. Provide `/admin/config` endpoint with model metadata
2. Provide CRUD routes at `{basePath}{routePath}` for each model
3. Require admin authentication (IsAdmin permission)
4. Return paginated list responses with `{data, page, limit, total, more}` structure

## Common Patterns

### Protected Admin Routes

```typescript
// app/_layout.tsx
import {useSelectCurrentUser} from "@/store/openApiSdk";
import {Redirect} from "expo-router";

function RootLayout() {
  const user = useSelectCurrentUser();
  
  // Redirect non-admin users away from admin routes
  if (!user?.admin && pathname.startsWith("/admin")) {
    return <Redirect href="/" />;
  }
  
  return <Stack />;
}
```

### Custom Field Renderers

Extend `AdminFieldRenderer` for custom field types:

```typescript
// In your app code
const CustomFieldRenderer = ({value, field, ...props}) => {
  if (field.type === "myCustomType") {
    return <MyCustomComponent value={value} />;
  }
  return <AdminFieldRenderer value={value} field={field} {...props} />;
};
```

## Error Handling

- Backend errors (401, 403, 500) are displayed in error states
- Form validation errors highlight invalid fields
- Network errors show error messages with retry option
- All mutations handle `.unwrap()` to catch errors
