# @terreno/admin-frontend

React Native components for building admin panels that connect to `@terreno/admin-backend`.

## Quick Start

``````typescript
// app/admin/index.tsx
import {AdminModelList} from "@terreno/admin-frontend";
import {api} from "@/store/openApiSdk";

export default function AdminScreen() {
  return <AdminModelList baseUrl="/admin" api={api} />;
}
``````

## Components

### AdminModelList

Entry screen showing all available models as cards.

``````typescript
<AdminModelList
  baseUrl="/admin"
  api={api}
/>
``````

Fetches config from `{baseUrl}/config` and displays clickable model cards.

### AdminModelTable

Table view for a specific model with pagination, sorting, and actions.

``````typescript
<AdminModelTable
  baseUrl="/admin"
  api={api}
  modelName="User"
/>
``````

Features:
- DataTable with columns from backend `listFields`
- Click row to edit
- "Create New" button
- Pagination controls
- Reference fields render as clickable links

### AdminModelForm

Create or edit form for a model instance.

``````typescript
<AdminModelForm
  baseUrl="/admin"
  api={api}
  modelName="User"
  id="507f1f77bcf86cd799439011"  // Optional for edit mode
/>
``````

Auto-generates fields from model schema:
- `string` → TextField
- `boolean` → BooleanField
- `number` → NumberField
- `date` → DateTimeField
- `objectid` (ref) → SelectField
- `enum` → SelectField with options

System fields (`_id`, `__v`, `created`, `updated`, `deleted`) are automatically skipped.

### AdminFieldRenderer

Renders field values in table cells with formatting.

``````typescript
<AdminFieldRenderer
  value={value}
  field={fieldConfig}
  modelName="User"
  baseUrl="/admin"
/>
``````

Handles booleans, dates, ObjectId refs, arrays, objects, and null/undefined.

### AdminRefField

Renders reference fields as clickable links.

``````typescript
<AdminRefField
  value={userId}
  refModel="User"
  baseUrl="/admin"
/>
``````

## Hooks

### useAdminConfig

Fetches admin configuration from backend.

``````typescript
const {config, isLoading, error} = useAdminConfig(api, baseUrl);
``````

Returns model metadata from `{baseUrl}/config`.

### useAdminApi

Generates RTK Query hooks for CRUD operations.

``````typescript
const {
  useListQuery,
  useGetQuery,
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
} = useAdminApi(api, baseUrl, modelName);

const {data, isLoading} = useListQuery({limit: 20, page: 1});
const [create] = useCreateMutation();
await create({email: "user@example.com"}).unwrap();
``````

## Expo Router Setup

``````typescript
// app/admin/_layout.tsx
import {Stack} from "expo-router";

export default function AdminLayout() {
  return <Stack screenOptions={{headerShown: false}} />;
}

// app/admin/index.tsx - Model list
import {AdminModelList} from "@terreno/admin-frontend";
export default () => <AdminModelList baseUrl="/admin" api={api} />;

// app/admin/[modelName]/index.tsx - Model table
import {AdminModelTable} from "@terreno/admin-frontend";
export default () => {
  const {modelName} = useLocalSearchParams();
  return <AdminModelTable baseUrl="/admin" api={api} modelName={modelName} />;
};

// app/admin/[modelName]/new.tsx - Create form
import {AdminModelForm} from "@terreno/admin-frontend";
export default () => {
  const {modelName} = useLocalSearchParams();
  return <AdminModelForm baseUrl="/admin" api={api} modelName={modelName} />;
};

// app/admin/[modelName]/[id].tsx - Edit form
import {AdminModelForm} from "@terreno/admin-frontend";
export default () => {
  const {modelName, id} = useLocalSearchParams();
  return <AdminModelForm baseUrl="/admin" api={api} modelName={modelName} id={id} />;
};
``````

## Protecting Admin Routes

``````typescript
// app/_layout.tsx
import {useSelectCurrentUser} from "@/store/openApiSdk";
import {Redirect} from "expo-router";

function RootLayout() {
  const user = useSelectCurrentUser();
  const pathname = usePathname();
  
  if (!user?.admin && pathname.startsWith("/admin")) {
    return <Redirect href="/" />;
  }
  
  return <Stack />;
}
``````

## Custom Field Renderers

Extend `AdminFieldRenderer` for custom field types:

``````typescript
const CustomFieldRenderer = ({value, field, ...props}) => {
  if (field.type === "myCustomType") {
    return <MyCustomComponent value={value} />;
  }
  return <AdminFieldRenderer value={value} field={field} {...props} />;
};
``````

## Integration

Expects backend to provide:
1. `GET {baseUrl}/config` — Model metadata
2. CRUD routes at `{basePath}{routePath}` for each model
3. Admin authentication (`IsAdmin` permission)
4. Paginated responses: `{data, page, limit, total, more}`
