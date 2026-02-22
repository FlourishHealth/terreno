---
description: '@terreno/admin-frontend - Admin panel React Native UI components'
applyTo: '**/*'
---
# @terreno/admin-frontend

React Native admin panel UI components for `@terreno/api` backends. This is a **frontend-only** package — no Express, no Mongoose, no backend code.

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
  index.tsx              # Package exports
  types.ts               # TypeScript interfaces
  useAdminConfig.ts      # Hook for fetching admin config
  useAdminApi.ts         # Hook for dynamic RTK Query endpoints
  AdminModelList.tsx     # Model card grid
  AdminModelTable.tsx    # DataTable with pagination
  AdminModelForm.tsx     # Dynamic create/edit form
  AdminFieldRenderer.tsx # Field type to UI component mapper
  AdminRefField.tsx      # ObjectId reference selector
```

## Components

### AdminModelList

Card grid showing all registered models. Fetches config from `GET {baseUrl}/config`.

```typescript
<AdminModelList baseUrl="/admin" api={terrenoApi} />
```

### AdminModelTable

Paginated DataTable for a specific model.

```typescript
<AdminModelTable 
  baseUrl="/admin" 
  api={terrenoApi} 
  modelName="Todo" 
/>
```

**Features:**
- Pagination with configurable page size
- Column sorting
- Date formatting (Luxon)
- Row click → edit form
- Create button in header

### AdminModelForm

Dynamic form for creating or editing model instances.

```typescript
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
```

**Features:**
- Field type mapping via `AdminFieldRenderer`
- Required field validation
- Default values in create mode
- Delete with confirmation (edit mode)
- Toast notifications

## Hooks

### useAdminConfig

Fetches admin configuration from backend.

```typescript
const {config, isLoading, error} = useAdminConfig(api, "/admin");
// config.models: AdminModelConfig[]
```

### useAdminApi

Dynamically injects RTK Query endpoints for a model.

```typescript
const {
  useListQuery,
  useReadQuery,
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
} = useAdminApi(api, "/admin/todos", "Todo");
```

## Field Type Mapping

`AdminFieldRenderer` maps OpenAPI types to @terreno/ui components:

| OpenAPI Type | UI Component | Notes |
|-------------|-------------|-------|
| `boolean` | `BooleanField` | Checkbox |
| `string` (enum) | `SelectField` | Dropdown |
| `string` (ref) | `AdminRefField` | Related model selector |
| `string` (date/time) | `DateTimeField` | ISO string picker |
| `number`, `integer` | `NumberField` | Numeric input |
| `string` (default) | `TextField` | Text input |

## System Fields

These fields are auto-excluded from forms:
- `_id`, `id`, `__v`
- `created`, `updated`, `deleted`

Defined in `SYSTEM_FIELDS` constant.

## Expo Router Integration

```typescript
// app/admin/index.tsx - Model list
export default function AdminScreen() {
  return <AdminModelList baseUrl="/admin" api={terrenoApi} />;
}

// app/admin/[model]/index.tsx - Model table
export default function AdminModelScreen() {
  const {model} = useLocalSearchParams<{model: string}>();
  return <AdminModelTable baseUrl="/admin" api={terrenoApi} modelName={model} />;
}

// app/admin/[model]/create.tsx - Create form
export default function AdminCreateScreen() {
  const {model} = useLocalSearchParams<{model: string}>();
  return <AdminModelForm baseUrl="/admin" api={terrenoApi} modelName={model} mode="create" />;
}

// app/admin/[model]/[id].tsx - Edit form
export default function AdminEditScreen() {
  const {model, id} = useLocalSearchParams<{model: string; id: string}>();
  return <AdminModelForm baseUrl="/admin" api={terrenoApi} modelName={model} mode="edit" itemId={id} />;
}
```

## Conventions

- Use @terreno/ui components (Box, Page, Card, DataTable, form fields) — never raw View/Text
- Use RTK Query hooks from `useAdminApi` for all API calls
- Use `useCallback` for event handlers
- Handle loading, error, and empty states
- Use `console.info/debug/warn/error` for permanent logs
- Use Luxon for date operations
- Always support React Native Web

## Related Packages

- `@terreno/admin-backend` - Backend plugin (required)
- `@terreno/ui` - UI component library (required)
- `@terreno/rtk` - RTK Query utilities (required)
