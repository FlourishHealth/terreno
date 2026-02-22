---
description: '@terreno/admin-frontend - Admin panel frontend screens for @terreno/api backends'
applyTo: '**/*'
---
# @terreno/admin-frontend

React Native admin panel screens for @terreno/api backends. Provides drop-in components for listing, viewing, creating, and editing model instances. This is a **frontend-only** package — no Express, no Mongoose, no backend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Purpose

Pre-built admin UI components that connect to @terreno/admin-backend endpoints. Handles CRUD operations, field rendering (text, date, boolean, references), validation, and list views with minimal configuration.

## Key Exports

### AdminModelList

```typescript
import {AdminModelList} from "@terreno/admin-frontend";

<AdminModelList
  modelName="users"
  baseUrl="/admin"
  navigation={navigation}
/>
```

List screen with:
- Table view of configured listFields
- Sorting and pagination
- Row click to detail/edit screen
- Create button

### AdminModelForm

```typescript
import {AdminModelForm} from "@terreno/admin-frontend";

<AdminModelForm
  modelName="users"
  baseUrl="/admin"
  itemId={id}  // Omit for create
  navigation={navigation}
/>
```

Auto-generated form with:
- Field type detection (text, boolean, date, number, reference)
- Validation from schema required/enum
- Save/cancel actions
- Reference field autocomplete

### AdminFieldRenderer

```typescript
import {AdminFieldRenderer} from "@terreno/admin-frontend";

<AdminFieldRenderer
  field={fieldConfig}
  value={value}
  onChange={setValue}
/>
```

Renders appropriate field component based on type:
- String → TextField
- Boolean → CheckBox
- Date → DateTimeField
- Number → NumberField
- Reference → AdminRefField (autocomplete dropdown)
- Enum → SelectField

### Hooks

```typescript
// Fetch admin config (model metadata)
const {config, isLoading, error} = useAdminConfig({baseUrl: "/admin"});

// Pre-configured RTK Query API for admin endpoints
const {useGetConfigQuery, useGetItemsQuery, useGetItemQuery, useCreateItemMutation, useUpdateItemMutation, useDeleteItemMutation} = useAdminApi({baseUrl: "/admin"});
```

## Integration Flow

1. Backend exposes `/admin/config` via @terreno/admin-backend
2. Frontend fetches config on mount with `useAdminConfig`
3. Config provides field metadata (type, required, enum, refs) for each model
4. Components render fields dynamically based on metadata
5. CRUD operations use RTK Query hooks from `useAdminApi`

## AdminScreenProps

```typescript
interface AdminScreenProps {
  modelName: string;       // Model key from config (e.g., "users")
  baseUrl?: string;        // Base URL for admin API (default: "/admin")
  navigation: any;         // React Navigation prop
  itemId?: string;         // For edit/detail screens
}
```

## Types

### AdminModelConfig

```typescript
interface AdminModelConfig {
  name: string;            // Model name
  routePath: string;       // API route path
  displayName: string;     // Human-readable name
  listFields: string[];    // Fields for list view
  defaultSort: string;     // Default sort order
  fields: Record<string, AdminFieldConfig>;
}
```

### AdminFieldConfig

```typescript
interface AdminFieldConfig {
  type: string;            // "string" | "boolean" | "number" | "date" | "array" | "object"
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  ref?: string;            // Reference to another model
}
```

## Conventions

- Use @terreno/ui components for rendering (Box, Text, Button, TextField, etc.)
- All components are React Native Web compatible
- Field rendering is extensible via AdminFieldRenderer
- System fields (_id, created, updated) are hidden from forms
- References auto-fetch options from the referenced model's list endpoint
