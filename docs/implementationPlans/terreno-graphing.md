# Implementation Plan: Admin Dashboards & Graphing

*When an engineer is assigned to a project but before you begin coding, you should fill in the implementation plan and get feedback from the engineering team. Once you have finished or you make any changes, tag Josh with the @ symbol so he can review. Also tag anyone else that needs to be notified, has conflicting work, etc.*

---

## Models

### `Dashboard` (new — `@terreno/ai`)

Persists admin-created dashboards with an ordered list of chart widgets.

```typescript
// ai/src/models/dashboard.ts

const dashboardWidgetSchema = new mongoose.Schema(
  {
    widgetId: {
      description: "Unique widget identifier (uuid v4)",
      required: true,
      type: String,
    },
    chart: {
      description: "Full ChartConfig — chart type, data source, axis configuration, filters",
      required: true,
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const dashboardSchema = new mongoose.Schema<DashboardDocument, DashboardModel>(
  {
    title: {
      description: "Dashboard title",
      required: true,
      trim: true,
      type: String,
    },
    description: {
      description: "Optional description shown in the dashboard list",
      type: String,
    },
    userId: {
      description: "Admin user who created the dashboard",
      index: true,
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    widgets: {
      default: [],
      description: "Ordered list of chart widgets",
      type: [dashboardWidgetSchema],
    },
  },
  { strict: "throw", toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Plugins: createdUpdatedPlugin, isDeletedPlugin, findExactlyOne, findOneOrNone
// Virtual: ownerId → userId (IsOwner compatibility)
```

### `ChartConfig` (TypeScript interface — stored as `Mixed`, validated with Zod at API boundary)

```typescript
// ai/src/types/chartTypes.ts

type ChartType =
  | "bar" | "bar-horizontal" | "bar-stacked" | "bar-grouped"
  | "line" | "line-multi"
  | "area" | "area-stacked"
  | "pie" | "donut"
  | "scatter" | "bubble"
  | "heatmap"
  | "combo";

type Aggregation =
  | "count" | "sum" | "avg" | "min" | "max" | "countDistinct"
  | "runningTotal" | "rank";  // runningTotal/rank require MongoDB 5+

type DateTrunc = "year" | "quarter" | "month" | "week" | "day" | "hour";

interface AxisConfig {
  field: string;
  label?: string;
  aggregation?: Aggregation;
  dateTrunc?: DateTrunc;
}

type FilterConfig =
  | { type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; field: string; value: unknown }
  | { type: "in" | "nin"; field: string; values: unknown[] }
  | { type: "dateRange"; field: string; from?: string; to?: string }
  | { type: "relative"; field: string; unit: DateTrunc; amount: number };

interface ChartConfig {
  type: ChartType;
  title: string;
  dataSource: string;          // Registered source name ("User" or "UsersWithActivity")
  x: AxisConfig;
  y: AxisConfig | AxisConfig[];
  color?: { field: string; label?: string };
  size?: AxisConfig;           // Bubble charts only
  filters?: FilterConfig[];
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;              // Default 1000, max 5000
}
```

### `DataSourceConfig` (TypeScript interface — registered by consuming app at startup, never persisted)

```typescript
// ai/src/types/chartTypes.ts (continued)

interface SimpleSource {
  type: "model";
  modelName: string;    // Mongoose model name (e.g. "User")
  displayName: string;
}

interface EnrichedSource {
  type: "enriched";
  name: string;                // Unique name (e.g. "UsersWithActivity")
  displayName: string;
  baseModel: string;           // Root Mongoose model name (for permission validation)
  pipeline: mongoose.PipelineStage[];
  outputFields: Record<string, {
    type: "string" | "number" | "date" | "boolean";
    description: string;
    role: "dimension" | "measure";
  }>;
}

type DataSourceConfig = SimpleSource | EnrichedSource;
```

**EnrichedSource example — "Users with Conversation Counts":**
```typescript
{
  type: "enriched",
  name: "UsersWithActivity",
  displayName: "Users (with Activity)",
  baseModel: "User",
  pipeline: [
    { $lookup: { from: "gpthistories", localField: "_id", foreignField: "userId", as: "histories" } },
    { $addFields: { conversationCount: { $size: "$histories" }, lastActiveAt: { $max: "$histories.updated" } } },
    { $project: { histories: 0 } },
  ],
  outputFields: {
    email:             { type: "string", description: "User email",          role: "dimension" },
    created:           { type: "date",   description: "Account created",     role: "dimension" },
    conversationCount: { type: "number", description: "Total conversations", role: "measure" },
    lastActiveAt:      { type: "date",   description: "Last activity date",  role: "dimension" },
  },
}
```

---

## APIs

### New: `addDashboardRoutes(router, options)` — `@terreno/ai`

All endpoints require `Permissions.IsAdmin`.

| Method | Path | Type | Description |
|--------|------|------|-------------|
| `POST` | `/dashboards` | modelRouter | Create a dashboard |
| `GET` | `/dashboards` | modelRouter | List dashboards (paginated, sorted `-updated`) |
| `GET` | `/dashboards/:id` | modelRouter | Get a single dashboard with all widgets |
| `PATCH` | `/dashboards/:id` | modelRouter | Update title, description, or full widgets array |
| `DELETE` | `/dashboards/:id` | modelRouter | Soft-delete a dashboard |
| `POST` | `/dashboards/query` | custom | Execute a `ChartConfig` → aggregation result |
| `GET` | `/dashboards/sources` | custom | List registered data sources + field metadata |

**`POST /dashboards/query`**
- Request body: `ChartConfig` (validated with Zod — strict, 400 on any schema error)
- Response: `{ data: ChartDataPoint[], meta: { total: number, truncated: boolean, pointCount: number } }`
- Pipeline construction order:
  1. Resolve data source (enriched: prepend base pipeline; simple: use model directly)
  2. `$match` — apply `FilterConfig[]`
  3. `$addFields` — apply `$dateTrunc` to date dimension fields
  4. `$group` — group by X (and color if present), compute Y aggregations
  5. `$setWindowFields` — for `runningTotal`/`rank` (MongoDB 5+ only; 400 if not available)
  6. `$sort` + `$limit` — cap at `limit` (default 1000, max 5000)
- Auto-bucketing: if date dimension would exceed limit, automatically coarsen granularity one level

**`GET /dashboards/sources`**
- Returns all registered data sources with their field metadata (type, role, description)
- Used by `DashboardBuilder` to populate the field picker

### Modified: `GET /admin/config` — `@terreno/admin-backend`

`AdminConfigResponse` gains a `dataSources` field. `AdminApp.register()` calls `DashboardApp.getSourcesMeta()` if a `DashboardApp` instance is provided, appending it to the config response.

```typescript
// Updated AdminConfigResponse
interface AdminConfigResponse {
  customScreens?: { displayName: string; name: string }[];
  models: AdminModelMeta[];
  scripts: AdminScriptMeta[];
  dataSources?: DataSourceMeta[];   // NEW — from DashboardApp if registered
}
```

### `DashboardApp` plugin — `@terreno/ai`

```typescript
import { DashboardApp } from "@terreno/ai";

const dashboardApp = new DashboardApp({
  dataSources: [
    { type: "model", modelName: "User", displayName: "Users" },
    { type: "model", modelName: "GptHistory", displayName: "Conversations" },
    {
      type: "enriched",
      name: "UsersWithActivity",
      displayName: "Users (with Activity)",
      baseModel: "User",
      pipeline: [...],
      outputFields: {...},
    },
  ],
});

new TerrenoApp({ userModel: User })
  .register(adminApp)
  .register(dashboardApp)
  .start();
```

The `DashboardApp` constructor detects MongoDB version and stores a `supportsWindowFields: boolean` flag used by the query engine.

---

## UI

All new components go in `@terreno/admin-frontend`. Add `recharts` as a dependency.

### New Components

#### `ChartWidget`
Renders a single `ChartConfig` + `data` using Recharts. Props: `chartConfig: ChartConfig`, `data: ChartDataPoint[]`, `isLoading?: boolean`, `error?: string`. Memoized with `React.memo` and deep equality on `chartConfig`.

Supports all 14 chart types via a switch on `chartConfig.type`. Uses Recharts primitives:
- Bar → `BarChart`
- Line / Line-multi → `LineChart`
- Area / Area-stacked → `AreaChart`
- Pie / Donut → `PieChart`
- Scatter / Bubble → `ScatterChart`
- Heatmap → `ResponsiveContainer` + SVG custom cells
- Combo → `ComposedChart` with `Bar` + `Line`

Dimensions use Terreno theme colors (maps to `theme.surface.primary`, `secondary`, etc.).

#### `DashboardViewer`
Renders a saved dashboard. Props: `dashboardId: string`, `api: Api`.
- Fetches dashboard via `GET /dashboards/:id`
- Each widget fires its own `POST /dashboards/query` RTK Query (parallel, 60s cache)
- Renders widgets in order as a vertical list of `ChartWidget`s in `Card`s
- "Edit Dashboard" button → navigates to `DashboardBuilder` in edit mode
- Per-widget loading/error states so one slow query doesn't block the rest

#### `DashboardBuilder`
Create or edit a dashboard. Props: `dashboardId?: string` (undefined = create mode), `api: Api`.

Layout:
```
┌─────────────────────────────────────────────┐
│  Dashboard Title  [Description]   [Save]    │
├──────────────────┬──────────────────────────┤
│  Data Source     │  Chart Type              │
│  [picker]        │  [type selector]         │
│                  │                          │
│  Fields          │  X Axis  [field] [trunc] │
│  Dimensions (🔵) │  Y Axis  [field] [agg]   │
│  - created       │  Color   [field]         │
│  - status        │                          │
│  Measures (🟢)   │  Filters [+ Add Filter]  │
│  - count         │  Sort    [field] [dir]   │
│  - total         │                          │
│                  │  ┌────────────────────┐  │
│                  │  │  Live Preview      │  │
│                  │  │  [ChartWidget]     │  │
│                  │  └────────────────────┘  │
├──────────────────┴──────────────────────────┤
│  Widgets  [+ Add Widget]                    │
│  [Widget 1 title]  [edit] [↑] [↓] [delete] │
│  [Widget 2 title]  [edit] [↑] [↓] [delete] │
└─────────────────────────────────────────────┘
```

- Live preview queries `POST /dashboards/query` on config change (debounced 500ms)
- "Add Widget" appends current config as a new widget
- Widget list shows mini-title + chart type icon; click to edit that widget's config
- Save POSTs or PATCHes the full dashboard and navigates to `DashboardViewer`

#### `DashboardList`
Lists all dashboards as cards. Props: `api: Api`, `baseUrl: string`.
- Card: title, description (truncated), widget count, last updated
- "Create New" button → `DashboardBuilder`
- Registered as a `customScreen` (`{ name: "dashboards", displayName: "Dashboards" }`) in `AdminApp.register()` so it appears in the admin panel nav automatically

### Navigation Flow

```
Admin Nav → "Dashboards" (customScreen)
  → DashboardList
      → [Create New] → DashboardBuilder (create)
          → [Save] → DashboardViewer
      → [click card] → DashboardViewer
          → [Edit] → DashboardBuilder (edit)
              → [Save] → DashboardViewer
```

### GPT Chat Integration (admin-only)

The frontend GPT chat component checks for `toolResult.chartConfig` in `toolResult` SSE events. If present:
- Calls `POST /dashboards/query` with the `chartConfig` immediately
- Renders inline `ChartWidget` below the tool result message
- `createDashboard` tool result shows a "View Dashboard →" link

No structural changes to the GPT route — new tools are registered via the existing `tools` option in `addGptRoutes`.

---

## Phases

### Phase 1 — Backend Core
**Goal:** Full backend infrastructure — model, types, Zod schema, query engine, plugin.
- `Dashboard` Mongoose model + TypeScript types
- `ChartConfig` + `DataSourceConfig` TypeScript interfaces
- Zod schema for `ChartConfig` (strict validation)
- `DashboardApp` plugin with data source registry + MongoDB version detection
- `addDashboardRoutes()` — modelRouter CRUD + `/query` + `/sources` custom endpoints
- Query execution engine: pipeline builder, auto-bucketing, `$setWindowFields` gating
- Export everything from `ai/src/index.ts`
- Unit tests for pipeline builder (filter generation, date trunc, aggregations, window fields)

### Phase 2 — Frontend Components
**Goal:** ChartWidget, DashboardViewer, DashboardList wired to live data.
- Add `recharts` dependency to `@terreno/admin-frontend`
- `ChartWidget` component (all 14 chart types, loading/error states)
- `DashboardViewer` screen (parallel widget queries, RTK cache)
- `DashboardList` screen (register as `customScreen` in `AdminApp`)
- RTK Query hooks for dashboard CRUD + `/query` endpoint
- Update `AdminConfigResponse` to include `dataSources`

### Phase 3 — Dashboard Builder
**Goal:** Full create/edit experience.
- `DashboardBuilder` component
- Data source picker + field list (dimensions 🔵 / measures 🟢)
- Chart type selector + axis/filter/sort configuration form
- Live preview with debounced query
- Widget add/reorder/delete
- Save flow (create vs. edit)

### Phase 4 — AI Tools
**Goal:** GPT can generate inline charts and create persistent dashboards.
- `generateChartTool` (inline, not persisted)
- `createDashboardTool` (persists, uses `createRequestTools` pattern for admin userId)
- Export `addDashboardGptTools(options)` for consuming apps
- Frontend: detect `chartConfig` in GPT tool results → render inline `ChartWidget`
- Frontend: render "View Dashboard →" link for `createDashboard` tool result
- Tests for Zod schema enforcement on AI tool inputs

---

## Feature Flags & Migrations

No feature flag needed — dashboards only appear in the admin panel and only after `DashboardApp` is registered by the consuming app. Apps that don't register it get no dashboards.

No data migrations required (new model, no existing data to transform).

`ChartConfig` stored as `Mixed` — add a `version: 1` field to all configs from day one to make future schema migrations traceable.

---

## Activity Log & User Updates

None for v1.

---

## Not Included / Future Work

- Drag-and-drop grid layout (Grafana-style) — linear list only for v1
- Chart sharing / public URLs
- Dashboard export (PDF / PNG)
- Non-admin user dashboards
- Scheduled refresh / snapshot history
- User-defined calculated fields (formulas over existing fields)
- Table calculations beyond `runningTotal` and `rank`
- Cross-database joins (MongoDB aggregation pipeline only)
- Chart annotations / reference lines
- Dashboard-level filters (apply to all widgets at once)

---

## Acceptance Criteria

*Run `/ip:acceptance` to generate detailed acceptance criteria.*

---

## Task List (Bot Consumption)

*Structured task breakdown for automated implementation. Each task is independently implementable and testable.*

### Phase 1: Backend Core

- [ ] **Task 1.1**: ChartConfig types and Zod schema
  - Description: Create `ai/src/types/chartTypes.ts` with all TypeScript interfaces (`ChartConfig`, `AxisConfig`, `FilterConfig`, `DataSourceConfig`, `ChartType`, `Aggregation`, `DateTrunc`). Create `ai/src/schemas/chartSchemas.ts` with strict Zod schema matching the TypeScript types. Export from `ai/src/types/index.ts`.
  - Files: `ai/src/types/chartTypes.ts` (new), `ai/src/schemas/chartSchemas.ts` (new), `ai/src/types/index.ts` (modify)
  - Depends on: none
  - Acceptance: Zod schema rejects invalid ChartConfig (missing required fields, unknown chart type, invalid aggregation). TypeScript types compile without errors.

- [ ] **Task 1.2**: Dashboard Mongoose model
  - Description: Create `ai/src/models/dashboard.ts` with `DashboardDocument`, `DashboardModel` interfaces, and the Mongoose schema. Apply `createdUpdatedPlugin`, `isDeletedPlugin`, `findExactlyOne`, `findOneOrNone`. Add `ownerId` virtual. Export from `ai/src/models/index.ts`.
  - Files: `ai/src/models/dashboard.ts` (new), `ai/src/models/index.ts` (modify), `ai/src/types/index.ts` (modify)
  - Depends on: 1.1
  - Acceptance: Model creates, reads, updates, soft-deletes. `ownerId` virtual returns `userId`. Schema enforces required fields.

- [ ] **Task 1.3**: Query execution engine
  - Description: Create `ai/src/service/dashboardQueryEngine.ts`. Implements `buildAggregationPipeline(chartConfig, source, options)` that produces a MongoDB `PipelineStage[]`. Handles: filter → dateTrunc addFields → group → setWindowFields (gated on MongoDB 5+) → sort → limit. Implements auto-bucketing for date dimensions that would exceed `limit`. Handles all `Aggregation` types including `countDistinct` (via `$addToSet` + `$size`).
  - Files: `ai/src/service/dashboardQueryEngine.ts` (new)
  - Depends on: 1.1
  - Acceptance: Unit tests cover: filter generation for all filter types, date trunc for all DateTrunc values, all aggregation types, auto-bucketing triggers when date range / limit exceeded, window fields produce correct pipeline when `supportsWindowFields: true` and throw 400 when `false`.

- [ ] **Task 1.4**: DashboardApp plugin
  - Description: Create `ai/src/dashboardApp.ts` implementing `TerrenoPlugin`. Constructor accepts `DashboardOptions` with `dataSources: DataSourceConfig[]`. Detects MongoDB version via `mongoose.connection.db.admin().serverInfo()` at `register()` time; stores `supportsWindowFields` flag. Calls `addDashboardRoutes(app, { dataSources, supportsWindowFields })`.
  - Files: `ai/src/dashboardApp.ts` (new), `ai/src/index.ts` (modify to export `DashboardApp`)
  - Depends on: 1.2, 1.3
  - Acceptance: `new DashboardApp({dataSources}).register(app)` mounts all routes. MongoDB version detection sets `supportsWindowFields` correctly.

- [ ] **Task 1.5**: Dashboard CRUD routes
  - Description: Create `ai/src/routes/dashboards.ts`. `addDashboardRoutes()` mounts modelRouter for `Dashboard` at `/dashboards` with `IsAdmin` permissions. Custom endpoint `POST /dashboards/query`: validates body with Zod ChartConfigSchema, resolves data source from registry, calls query engine, executes aggregation, returns `{data, meta}`. Custom endpoint `GET /dashboards/sources`: returns registered source names + field metadata.
  - Files: `ai/src/routes/dashboards.ts` (new), `ai/src/routes/index.ts` (modify)
  - Depends on: 1.3, 1.4
  - Acceptance: CRUD endpoints return correct responses. `POST /dashboards/query` with valid config returns `{data, meta}`. Unknown data source returns 400. Invalid ChartConfig (Zod) returns 400 with field errors. Non-admin gets 403.

- [ ] **Task 1.6**: Pipeline builder unit tests
  - Description: Write `ai/src/service/dashboardQueryEngine.test.ts` with comprehensive tests for the pipeline builder. Cover all filter types, all aggregations, date trunc values, auto-bucketing, window fields gating, countDistinct implementation.
  - Files: `ai/src/service/dashboardQueryEngine.test.ts` (new)
  - Depends on: 1.3
  - Acceptance: `bun run ai:test` passes. All pipeline builder branches covered.

---

### Phase 2: Frontend Components

- [ ] **Task 2.1**: Add recharts + RTK hooks
  - Description: Add `recharts` to `admin-frontend/package.json`. Create `admin-frontend/src/useDashboardApi.ts` with RTK Query hooks: `useListDashboardsQuery`, `useGetDashboardQuery`, `useCreateDashboardMutation`, `useUpdateDashboardMutation`, `useDeleteDashboardMutation`, `useQueryChartMutation`, `useGetSourcesQuery`. Pattern matches existing `useAdminApi.ts`.
  - Files: `admin-frontend/package.json` (modify), `admin-frontend/src/useDashboardApi.ts` (new)
  - Depends on: 1.5
  - Acceptance: `recharts` importable. All hooks call correct endpoints with correct args.

- [ ] **Task 2.2**: ChartWidget component
  - Description: Create `admin-frontend/src/ChartWidget.tsx`. Props: `chartConfig: ChartConfig`, `data: ChartDataPoint[]`, `isLoading?: boolean`, `error?: string`. Switch on `chartConfig.type` to render correct Recharts component. All 14 chart types supported. Wrapped in `React.memo`. Renders `Spinner` when loading, error text when errored, "No data" state when empty. Uses Terreno theme colors from `useTheme()`.
  - Files: `admin-frontend/src/ChartWidget.tsx` (new), `admin-frontend/src/index.tsx` (modify to export)
  - Depends on: 2.1
  - Acceptance: All 14 chart types render without TypeScript errors. Loading/error/empty states visible. Memoized (doesn't re-render on unrelated parent changes).

- [ ] **Task 2.3**: DashboardList screen
  - Description: Create `admin-frontend/src/DashboardList.tsx`. Fetches all dashboards with `useListDashboardsQuery`. Renders as cards (title, description, widget count, last updated). "Create New" button. "View" button per card. Registers as `customScreen` by modifying `AdminApp.register()` to append `{name: "dashboards", displayName: "Dashboards"}` to the `customScreens` array in the config response.
  - Files: `admin-frontend/src/DashboardList.tsx` (new), `admin-frontend/src/index.tsx` (modify), `admin-backend/src/adminApp.ts` (modify to include dashboards customScreen when DashboardApp present — or always include it)
  - Depends on: 2.1
  - Acceptance: Dashboard list renders. "Create New" navigates to builder route. Empty state shows when no dashboards. Custom screen "Dashboards" appears in admin nav.

- [ ] **Task 2.4**: DashboardViewer screen
  - Description: Create `admin-frontend/src/DashboardViewer.tsx`. Props: `dashboardId: string`, `api`. Fetches dashboard via `useGetDashboardQuery`. For each widget, fires `useQueryChartMutation` in parallel (via `useEffect` per widget). Renders widgets as vertical list of `ChartWidget`s inside `Card`s. Per-widget loading/error. "Edit Dashboard" button. "Delete" button with confirmation.
  - Files: `admin-frontend/src/DashboardViewer.tsx` (new), `admin-frontend/src/index.tsx` (modify)
  - Depends on: 2.2, 2.3
  - Acceptance: Dashboard loads. Each widget queries independently (parallel network requests visible). Slow query shows spinner for that widget only. Edit button visible. Delete with confirmation works.

---

### Phase 3: Dashboard Builder

- [ ] **Task 3.1**: Field picker and source selector sub-components
  - Description: Create `admin-frontend/src/builder/DataSourcePicker.tsx` (dropdown of available sources from `useGetSourcesQuery`) and `admin-frontend/src/builder/FieldList.tsx` (renders dimension fields in blue-ish style, measure fields in green-ish, per Tableau convention). Used by `DashboardBuilder`.
  - Files: `admin-frontend/src/builder/DataSourcePicker.tsx` (new), `admin-frontend/src/builder/FieldList.tsx` (new)
  - Depends on: 2.1
  - Acceptance: Source picker shows all registered sources. Field list shows fields categorized by role with correct visual styling.

- [ ] **Task 3.2**: Chart config form sub-components
  - Description: Create `admin-frontend/src/builder/ChartTypeSelector.tsx` (grid of chart type icons), `admin-frontend/src/builder/AxisConfigForm.tsx` (field + aggregation + dateTrunc pickers), `admin-frontend/src/builder/FilterBuilder.tsx` (add/remove filters with field/op/value pickers), `admin-frontend/src/builder/SortConfig.tsx`.
  - Files: `admin-frontend/src/builder/ChartTypeSelector.tsx` (new), `admin-frontend/src/builder/AxisConfigForm.tsx` (new), `admin-frontend/src/builder/FilterBuilder.tsx` (new), `admin-frontend/src/builder/SortConfig.tsx` (new)
  - Depends on: 3.1
  - Acceptance: Each sub-form renders correctly. Aggregation picker shows/hides `runningTotal`/`rank` based on whether `supportsWindowFields` is true (from sources metadata). DateTrunc picker only appears for date-type fields.

- [ ] **Task 3.3**: DashboardBuilder main component
  - Description: Create `admin-frontend/src/DashboardBuilder.tsx`. Props: `dashboardId?: string` (edit mode), `api`. Fetches existing dashboard if editing. Manages state: `title`, `description`, `widgets[]`, `activeWidgetIndex`. Renders left panel (DataSourcePicker + FieldList) and right panel (ChartTypeSelector + AxisConfigForm + FilterBuilder + SortConfig + live preview ChartWidget). Live preview calls `useQueryChartMutation` debounced 500ms on config change. Widget list at bottom: add/reorder (up/down)/delete. Save calls create or update mutation, navigates to viewer on success.
  - Files: `admin-frontend/src/DashboardBuilder.tsx` (new), `admin-frontend/src/index.tsx` (modify)
  - Depends on: 3.1, 3.2, 2.4
  - Acceptance: Can create a dashboard end-to-end (pick source → configure chart → add widget → save → view). Live preview updates on field change (debounced). Edit mode pre-populates all fields. Reorder/delete widgets works.

---

### Phase 4: AI Tools

- [ ] **Task 4.1**: generateChart and createDashboard tools
  - Description: Create `ai/src/service/dashboardTools.ts`. Exports `createGenerateChartTool(options)` and `createDashboardTool(options)` where options includes the data source registry and a `getUserId` function. Both use Zod ChartConfigSchema for strict parameter validation. `generateChart` executes the query and returns `{chartConfig, data}` so the frontend can render immediately. `createDashboard` creates a `Dashboard` document and returns `{dashboardId, title, widgetCount}`.
  - Files: `ai/src/service/dashboardTools.ts` (new)
  - Depends on: 1.3, 1.4
  - Acceptance: `createGenerateChartTool` returns a Vercel AI SDK `Tool` object with correct Zod schema. Invalid ChartConfig input is rejected by Zod before execute runs. `createDashboardTool` creates a Dashboard document in the DB.

- [ ] **Task 4.2**: Export addDashboardGptTools
  - Description: Create `ai/src/routes/gptDashboardTools.ts` exporting `addDashboardGptTools(options)` that returns `Record<string, Tool>` containing both tools. Consuming apps pass this to `addGptRoutes` via `createRequestTools`. Export from `ai/src/index.ts`.
  - Files: `ai/src/routes/gptDashboardTools.ts` (new), `ai/src/index.ts` (modify)
  - Depends on: 4.1
  - Acceptance: Tools integrate with existing `addGptRoutes` via `tools` option. Tool calls appear in SSE stream as `{toolCall}` / `{toolResult}` events.

- [ ] **Task 4.3**: Frontend: render charts from GPT tool results
  - Description: In the consuming app's GPT chat component (or in a new `DashboardToolResult` component exported from `@terreno/admin-frontend`), detect `toolResult.result.chartConfig` and render inline `ChartWidget` with `toolResult.result.data`. For `createDashboard` results, render a "View Dashboard →" link using `toolResult.result.dashboardId`.
  - Files: `admin-frontend/src/DashboardToolResult.tsx` (new), `admin-frontend/src/index.tsx` (modify)
  - Depends on: 4.2, 2.2
  - Acceptance: GPT chat renders inline chart when AI calls `generateChart`. "View Dashboard" link appears when AI calls `createDashboard`. Non-chart tool results are unaffected.

- [ ] **Task 4.4**: AI tool tests
  - Description: Write `ai/src/service/dashboardTools.test.ts`. Test that Zod schema validation rejects invalid configs. Test that `generateChart` calls the query engine. Test that `createDashboard` creates a database record.
  - Files: `ai/src/service/dashboardTools.test.ts` (new)
  - Depends on: 4.1
  - Acceptance: `bun run ai:test` passes. Invalid input test cases reject before execute. DB record created for `createDashboard` success case.
