# Research: Graphing & Dashboard Capabilities for GPT and Admin Tools

## Summary

Tableau's conceptual model maps cleanly onto MongoDB: Dimensions → `$group._id` fields, Measures → aggregation expressions, LOD expressions → `$lookup` sub-pipelines, Calculated fields → `$addFields`, and Date hierarchies → `$dateTrunc`. The key insight from Tableau is that **data source** is a first-class concept separate from the chart — supporting "enriched models" (pre-defined aggregation pipelines that join multiple models and add computed fields) is the right way to handle higher-order data, following Tableau's Custom SQL / Relationships pattern. Recharts is the charting library (web-only per PRD). Dashboards are admin-only.

## Context

- **Problem:** Admins can't visualize data from the admin panel or GPT chat — everything is raw tables.
- **Why:** Dashboards + inline charts dramatically increase the value of AI-assisted data exploration.
- **Current state:** No charting anywhere. `react-native-svg` 15.12.1 is in the catalog. AI tool system handles structured SSE responses. Admin panel exposes full typed model metadata via `GET /admin/config`.

## Decisions Made

1. **Admin-only dashboards** — only admins can create and view dashboards; only in the admin screen.
2. **EnrichedSource is admin-only** — only pre-registered pipelines (no user-defined raw pipelines).
3. **Linear widget layout** — list of charts stacked vertically; no drag-and-drop grid for v1.
4. **Running totals supported** — use MongoDB 5+ `$setWindowFields`; detect version and offer conditionally.
5. **Strict Zod schema for AI tools** — AI must produce valid `ChartConfig` or explain failure; no loose fallbacks.
6. **No per-user chart access** — only admins chart data.

## Findings

### 1. GPT Chat Streaming System

`POST /gpt/prompt` in `ai/src/routes/gpt.ts:82` streams SSE events: `{text}`, `{toolCall}`, `{toolResult}`, `{image}`, `{file}`, `{done}`. A new `{chart: ChartConfig}` SSE event type follows the exact same pattern as `{image}`. The `tools` option in `addGptRoutes` means adding a `generateChart` or `createDashboard` AI tool requires zero changes to the core route handler.

### 2. Admin Backend

`AdminApp` in `admin-backend/src/adminApp.ts:164` accepts `models: AdminModelConfig[]` and has full field metadata from `getOpenApiSpecForModel`. The `customScreens` array in `AdminConfigResponse` is the hook for adding a "Dashboards" screen to the admin panel. The dashboard query engine can receive the same `models` array.

### 3. No Existing Charting

No charting libraries anywhere. `react-native-svg` 15.12.1 is in the catalog, but since PRD says web-only, Recharts is the right choice — no RN-SVG dependency needed, simpler API, more powerful for web.

### 4. MongoDB → Tableau Feature Mapping

| Tableau Concept | MongoDB Equivalent |
|---|---|
| Dimension (GROUP BY) | `$group: {_id: "$field"}` |
| Date hierarchy (truncate to month) | `$dateTrunc: {date: "$created", unit: "month"}` |
| Measure: SUM/AVG/MIN/MAX | `$group: {total: {$sum: "$amount"}}` |
| Measure: COUNT | `$group: {count: {$sum: 1}}` |
| Measure: COUNT DISTINCT | `$addToSet` + `$size` |
| Calculated field (row-level) | `$addFields: {margin: {$divide: ["$profit", "$sales"]}}` |
| Filter (dimension) | `$match: {status: "active"}` |
| Filter (measure / HAVING) | `$match` after `$group` |
| Top N | `$sort` + `$limit` after `$group` |
| LOD FIXED (per-entity total) | `$lookup` with sub-pipeline aggregation |
| Table calc: Running total | `$setWindowFields` with `$sum` (MongoDB 5+) |
| Table calc: Rank | `$setWindowFields` with `$rank` (MongoDB 5+) |
| Percent of total | Two-pass: main agg + facet for total, then `$divide` |
| Calculated field | `$addFields` expression |
| Custom SQL / enriched source | Pre-defined `PipelineStage[]` registered by consuming app |
| Data blending / JOIN | `$lookup` stages |

### 5. Dimensions vs. Measures

Tableau's core conceptual split, applied here:

- **Dimensions** = fields you GROUP BY (categorical strings, booleans, date-truncated timestamps). Go on X axis, Color channel, or filters. Every field in a data source declares its role.
- **Measures** = numeric fields you aggregate (SUM, AVG, COUNT, etc.). Go on the Y axis or Size channel.
- **Date fields** are special dimensions — they can be bucketed at different granularities (year, month, day, hour).

### 6. The "Enriched Model" Concept (Higher-Order Data Sources)

An **EnrichedSource** is a pre-defined MongoDB aggregation pipeline registered by the consuming app. It is the equivalent of Tableau's Custom SQL or Relationships — it can join multiple models, add computed fields, and produce a declared output schema that the dashboard builder treats identically to a simple model.

**Example — "Users with Conversation Counts":**
```typescript
{
  type: "enriched",
  name: "UsersWithActivity",
  displayName: "Users (with Activity)",
  baseModel: "User",
  pipeline: [
    {$lookup: {
      from: "gpthistories",
      localField: "_id",
      foreignField: "userId",
      as: "histories"
    }},
    {$addFields: {
      conversationCount: {$size: "$histories"},
      lastActiveAt: {$max: "$histories.updated"},
    }},
    {$project: {histories: 0}},
  ],
  outputFields: {
    email: {type: "string", description: "User email", role: "dimension"},
    created: {type: "date", description: "Account created date", role: "dimension"},
    conversationCount: {type: "number", description: "Total conversations", role: "measure"},
    lastActiveAt: {type: "date", description: "Last activity date", role: "dimension"},
  }
}
```

### 7. Chart Types Supported (v1)

| Chart Type | X (dimension) | Y (measure) | Color (optional) | Notes |
|---|---|---|---|---|
| `bar` | Categorical / date | 1 measure | — | Vertical bars |
| `bar-horizontal` | 1 measure | Categorical | — | Horizontal bars |
| `bar-stacked` | Categorical / date | 1 measure | Dimension | Stacked segments |
| `bar-grouped` | Categorical / date | 1 measure | Dimension | Side-by-side |
| `line` | Date / ordered | 1+ measures | — | Time series |
| `line-multi` | Date / ordered | 1 measure | Dimension | Multi-series lines |
| `area` | Date / ordered | 1+ measures | — | Filled area |
| `area-stacked` | Date / ordered | 1 measure | Dimension | Stacked area |
| `pie` | — | 1 measure | Dimension | Part-to-whole |
| `donut` | — | 1 measure | Dimension | Pie with hole |
| `scatter` | 1 measure | 1 measure | Dimension (opt) | Correlation |
| `bubble` | 1 measure | 1 measure | Dimension (opt) | Scatter + size encoding |
| `heatmap` | Dimension | Dimension | Measure | Cross-tab with color |
| `combo` | Date | 2 measures | — | Bar + line dual axis |

### 8. The ChartConfig Data Model

```typescript
interface ChartConfig {
  type: ChartType;
  title: string;
  dataSource: DataSourceRef;     // name of registered SimpleSource or EnrichedSource

  // Visual encodings
  x: AxisConfig;                 // X axis: dimension or date with optional truncation
  y: AxisConfig | AxisConfig[];  // Y axis: one or more measures
  color?: SeriesConfig;          // Color channel: dimension for multi-series/stacked
  size?: AxisConfig;             // Size channel for bubble charts

  // Filters
  filters?: FilterConfig[];

  // Sort
  sort?: {field: string; direction: "asc" | "desc"};

  // Performance cap
  limit?: number;                // Max data points (default 1000, max 5000)
}

interface AxisConfig {
  field: string;
  label?: string;
  aggregation?: "count" | "sum" | "avg" | "min" | "max" | "countDistinct" | "runningTotal" | "rank";
  dateTrunc?: "year" | "quarter" | "month" | "week" | "day" | "hour";
}

type FilterConfig =
  | {type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; field: string; value: any}
  | {type: "in" | "nin"; field: string; values: any[]}
  | {type: "dateRange"; field: string; from?: string; to?: string}
  | {type: "relative"; field: string; unit: "year" | "month" | "week" | "day" | "hour"; amount: number};
```

### 9. Data Source Registration

```typescript
type DataSourceConfig = SimpleSource | EnrichedSource;

interface SimpleSource {
  type: "model";
  modelName: string;    // Mongoose model name, must be in AdminApp's models list
  displayName: string;
}

interface EnrichedSource {
  type: "enriched";
  name: string;
  displayName: string;
  baseModel: string;    // Root model name (for permissions — must be admin-accessible)
  pipeline: PipelineStage[];
  outputFields: Record<string, {
    type: "string" | "number" | "date" | "boolean";
    description: string;
    role: "dimension" | "measure";
  }>;
}
```

### 10. Dashboard Persistence Model (new in @terreno/ai)

```typescript
interface Dashboard {
  title: string;
  userId: ObjectId;      // Admin user who created it
  description?: string;
  widgets: DashboardWidget[];
  created: Date;
  updated: Date;
  deleted: boolean;
}

interface DashboardWidget {
  widgetId: string;      // Local widget ID (uuid v4)
  chart: ChartConfig;    // Full chart config
}
```

### 11. Backend Query Execution

`POST /dashboards/query` (admin-only, `IsAdmin` permission):
```
Body: ChartConfig
Returns: {data: ChartDataPoint[], meta: {total: number, truncated: boolean, mongodbVersion: string}}
```

Pipeline construction order:
1. Start with enriched source base pipeline (if applicable)
2. `$match` — apply filters
3. `$addFields` — apply `$dateTrunc` to date dimension fields
4. `$group` — group by X (and color if present), aggregate Y measures
5. `$setWindowFields` — for `runningTotal` or `rank` aggregations (MongoDB 5+ only; version detected at startup)
6. `$sort` — by X field or measure
7. `$limit` — cap at configured limit (default 1000)

Auto-bucketing: if a date dimension would produce > limit unique values, automatically coarsen (days → months, months → quarters).

### 12. AI Tools

**`generateChart` tool** (inline GPT chart, not persisted, admin-only):
```typescript
{
  name: "generateChart",
  description: "Generate a chart from model data and display it inline in the chat",
  parameters: z.object({chartConfig: ChartConfigSchema}),
  execute: async ({chartConfig}) => ({chartConfig})
  // Returns {chartConfig} as tool result → frontend renders ChartWidget inline
}
```

**`createDashboard` tool** (persists to DB, admin-only):
```typescript
{
  name: "createDashboard",
  description: "Create a persistent admin dashboard with one or more charts",
  parameters: z.object({
    title: z.string(),
    description: z.string().optional(),
    widgets: z.array(z.object({chart: ChartConfigSchema})),
  }),
  execute: async ({title, description, widgets}, {userId}) => {
    const dashboard = await Dashboard.create({title, description, widgets: widgets.map(...), userId});
    return {dashboardId: dashboard._id.toString(), title, widgetCount: widgets.length}
  }
}
```

Both are registered via `addGptRoutes` `tools` option — no core route changes needed. The `createRequestTools` pattern from `GptRouteOptions` is used to inject the admin user's ID into the tool executor.

### 13. Performance Strategy

1. **Server-side aggregation only** — never stream raw documents to charts
2. **Point cap** — 1000 default, 5000 absolute max
3. **Auto-bucketing** — coarsen date granularity if row count would exceed limit
4. **RTK Query cache** — 60s TTL for `/dashboards/query`
5. **Parallel widget fetching** — each Dashboard widget fires its own RTK Query independently
6. **React.memo on ChartWidget** — memoized on `chartConfig` deep equality
7. **Index awareness** — query endpoint can warn if querying fields not in `Model.collection.indexes()`

## Package Changes

| Package | Changes |
|---|---|
| `@terreno/ai` | New: `Dashboard` model, `addDashboardRoutes()`, `DashboardApp` plugin, `ChartConfig` types, AI tools |
| `@terreno/admin-backend` | Minor: expose data source registry to dashboard query engine |
| `@terreno/admin-frontend` | New: `ChartWidget`, `Dashboard` screen, `DashboardBuilder`, `DashboardList`; add `recharts` dep |
| `@terreno/ui` | No changes |
| `@terreno/rtk` | No changes |

## References

- `ai/src/routes/gpt.ts:82` — SSE streaming, tool call/result pattern
- `ai/src/types/index.ts` — `GptHistoryPrompt`, `GptRouteOptions.tools`
- `admin-backend/src/adminApp.ts:164` — `AdminApp`, model registration, `customScreens`
- `admin-frontend/src/AdminModelTable.tsx` — DataTable + model config integration
- `admin-frontend/src/types.ts` — `AdminConfigResponse` with `customScreens`
- Root `package.json:54` — `react-native-svg: 15.12.1` in catalog
- Recharts: https://recharts.org
- MongoDB `$setWindowFields`: https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/
- MongoDB `$dateTrunc`: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/
