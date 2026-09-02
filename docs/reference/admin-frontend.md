# @terreno/admin-frontend

React Native components for building admin panels that connect to `@terreno/admin-backend`.

**Build a screen or change nav:** [How admin interfaces are shaped](../explanation/admin-interface.md)
and [Build admin screens](../how-to/build-admin-screens.md).

## Quick Start

Home is `AdminHome` inside `AdminProvider` + `AdminShellLayout`. Generic models use
`AdminScreenRouter` on `[model]/index`. See the how-to for `apiBase` vs `routeBase`.

``````typescript
// app/admin/index.tsx
import {AdminHome} from "@terreno/admin-frontend";
import {api} from "@/store/openApiSdk";

export default function AdminScreen() {
  return <AdminHome api={api} apiBase="/admin" routeBase="/admin" />;
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

### AdminRolesList

Role editing starts with a dedicated **Admin page** toggle for `admin:access`. That is the only
permission that opens the admin panel. Grant it first; model and tool permissions do nothing until
the role can enter.

Standard admin model permissions then use one access-level selector:

- No access
- Read only
- Read + write owned
- Read + write all

Other application and screen permissions remain individual toggles. Saving writes the same
permission JSON used by `rbacRouter`, so no separate configuration format is required.

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
3. `admin:access` (or `IsAdmin` when RBAC is off) to open the page; per-model RBAC after that
4. Paginated responses: `{data, page, limit, total, more}`

When RBAC is enabled, `/admin/config` is filtered for the current user. `AdminShell` uses its
`platformTools` flags to hide denied Scripts, Roles, Version, and Configuration links, and only
renders model or custom-screen links returned by the server.

### Custom screen page chrome

Wrap custom admin screen content in `AdminScreenPage`. It renders the standard `Page` header with a back arrow by default; the arrow navigates to `/admin` via `router.push`, not `router.back()`, because sidebar navigation does not always leave a reliable history entry on web. Pass the host's `routeBase` as `backHref` when admin uses a different prefix; an empty standalone-admin base resolves to `/`. Detail screens can target their parent route (for example `/admin/comms`). Pass `backButton={false}` only when the host supplies equivalent navigation.

```typescript
import {AdminScreenPage} from "@terreno/admin-frontend";

<AdminScreenPage title="Operations" scroll>
  <OperationsDashboard />
</AdminScreenPage>
```

### Comms dashboard

`COMMS_ADMIN_WIDGETS.comms` is registered in the built-in screen registry. `CommsApp` contributes
custom screen `name: "comms"`. Hosts should also add message detail routes so `/comms/:id` is not
handled as a generic model form:

```typescript
import {CommsDashboardScreenWidget, CommsMessageDetail} from "@terreno/admin-frontend";

// list: /admin/comms
<CommsDashboardScreenWidget api={api} config={config} routeBase="/admin" screenName="comms" />

// detail: /admin/comms/[id]
<CommsMessageDetail api={api} messageId={id} routeBase="/admin" />
```

The list screen persists filters in the URL (`channel`, `provider`, `status`, `errorClass`, `q`,
`startDate`, `endDate`, `page`) and calls `/comms/messages`, `/comms/stats`, and
`/comms/messages/retryMany`.

### AI Observability chrome

`ObservabilityApp` contributes grouped custom screens (`group: "AI Observability"`): `ai-prompts`,
`ai-traces`, `ai-evaluators`, `ai-datasets`, `ai-experiments`, and `ai-review` when the local
plugin is on. `AI Requests` (`ai-requests`) stays ungrouped. Widgets also register detail routes:
`ai-prompt-editor`, `ai-trace-detail`, `ai-review-item`, `ai-evaluator-detail`, `ai-evaluator-new`,
`ai-dataset-detail`, `ai-experiment-new`, and `ai-experiment-results`.

Every observability screen wraps `AiObservabilityChrome`: breadcrumbs
`Admin / AI Observability / <Section> / <leaf>` and a status chip from
`GET /ai/observability/status` (`Local on|off` plus active primaries). Review queue nav and the
review screen body hide when `localOn` is false.

`ai-prompts` lists prompts with a folder rail, search, type badge, latest vs production columns
(tooltips), 7-day usage, and **Create prompt**. `ai-prompt-editor?name=` is the versioned editor:
version rail with production/latest dots, Editor / Playground tabs, **Save as vN+1**, and
**Set vN as production…** (modal names the outgoing version). Playground **Run once** does not
create a version; **Save this run to dataset** stays disabled until phase 2.

`ai-traces` lists traces with a filter bar (from/to, prompt, status, user, session, has score,
sensitive), checkbox selection, and a bulk bar: **Send to review queue**, a sensitive-count
warning, **Clear**, and **Add to dataset** (opens a dataset picker modal; sensitive traces show a
warning before bulk add). Rows show a status dot,
`sensitive` badge, error line, `N prompts`, span count, tokens, cost, latency, score count, and
**Open**. Pagination uses `page` / `limit` / `more` / `total`.
`ai-trace-detail?id=` shows the header, left span list (kind badge, indent, duration bar),
right span detail with **collapsed** sensitive I/O, and scores (value + source).

`ai-review` shows Pending / In progress / Done / Skipped tabs with counts. Each tab is
oldest-first and lists the trace action, prompt, assignee, waiting time, and status.
**Start reviewing — oldest first** opens the first pending item; the empty state names both
Traces intake and manual **Assign to me** assignment.

`ai-review-item?id=` shows "Item N of M pending", previous/next navigation, read-only
**What the AI was given** / **What the AI wrote** panels, collapsed long fields with word
counts, reviewer notes, and a collapsed Raw JSON disclosure. Score controls come from evaluator
dimensions (numeric slider, boolean Pass / Fail, categorical pills). Actions are
**Submit & next**, **Skip**, and **Assign to me**; completion toasts report the remaining count
or **Queue clear**.

`ai-evaluators` lists evaluators with type badge, dimension summary, target, and run-mode chips.
**Create evaluator** opens `ai-evaluator-new` with type (human / JSON assert / LLM judge), target,
dimension builder, type-specific config (judge prompt name, assertion path/constraint, or reviewer
instructions), live-sampling rate, and inline schema-mismatch errors naming the missing dimension
key. `ai-evaluator-detail?id=` shows dimensions, type-specific config, run modes, and a **Used by**
table derived from recent experiments.

`ai-datasets` lists datasets with item counts, provenance bar, input-schema binding, and updated
time. **New dataset** creates a dataset; **Import** on each row accepts `.json` or `.csv` via
`FilePickerButton` (local URI read) or paste, posting `{rows}` for JSON or `{format:'csv',content}`
for CSV. `ai-dataset-detail?id=` shows counts, schema binding, tabs **All / Human / Auto / Needs
review**, an items table (input, expected, provenance, trace link), **Add item**, and **Run
experiment** navigation.

`ai-experiments` lists experiments with status, running progress, and cost. **New experiment**
opens a four-step wizard (dataset with counts, prompt versions tagged latest/production/superseded,
evaluators, review & run with estimate). `includeUnproofread` and optional model override are on
the wizard. `ai-experiment-results?id=` polls while pending/running, shows gate tiles per version,
failing gate count, outliers, a side-by-side per-item output table (failed rows first from the
API), and **Promote to production** with a confirm modal; promote is blocked when gates fail (409).
