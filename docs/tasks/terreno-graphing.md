# Tasks: Admin Dashboards & Graphing

*Source: docs/implementationPlans/terreno-graphing.md*

---

### Phase 1: Backend Core

- [x] **Task 1.1**: ChartConfig types and Zod schema
  - Description: Create `admin-backend/src/dashboard/chartTypes.ts` with all TypeScript interfaces (`ChartConfig`, `AxisConfig`, `FilterConfig`, `DataSourceConfig`, `ChartType`, `Aggregation`, `DateTrunc`). Create Zod schema with `chartConfigSchema`. Export from `admin-backend/src/index.ts`.
  - Files: `admin-backend/src/dashboard/chartTypes.ts` (new), `admin-backend/src/index.ts` (modify)
  - Depends on: none
  - Acceptance: Zod schema rejects invalid ChartConfig. TypeScript compiles without errors.

- [x] **Task 1.2**: Dashboard Mongoose model
  - Description: Create `admin-backend/src/dashboard/dashboard.ts` with document/model interfaces and Mongoose schema. Apply `createdUpdatedPlugin`, `isDeletedPlugin`, `findExactlyOne`, `findOneOrNone`. Pre-save hook generates widgetIds via `randomUUID()`.
  - Files: `admin-backend/src/dashboard/dashboard.ts` (new), `admin-backend/src/index.ts` (modify)
  - Depends on: 1.1
  - Acceptance: Model CRUD works. Schema enforces required fields.

- [x] **Task 1.3**: Query execution engine
  - Description: Create `admin-backend/src/dashboard/dashboardQueryEngine.ts`. Builds MongoDB `PipelineStage[]` from `ChartConfig`. Handles filter → dateTrunc addFields → group → setWindowFields (gated on MongoDB 5+) → sort → limit. Auto-bucketing for date dimensions. All aggregation types including `countDistinct`. `allowDiskUse: true, maxTimeMS: 30000`.
  - Files: `admin-backend/src/dashboard/dashboardQueryEngine.ts` (new)
  - Depends on: 1.1
  - Acceptance: Unit tests pass for all filter types, aggregations, date trunc, auto-bucketing, and window field gating.

- [x] **Task 1.4**: DashboardApp plugin
  - Description: Create `admin-backend/src/dashboard/dashboardApp.ts` implementing `TerrenoPlugin`. Accepts `dataSources: DataSourceConfig[]`. Detects MongoDB version at `register()` time via try/catch. Calls `addDashboardRoutes()`.
  - Files: `admin-backend/src/dashboard/dashboardApp.ts` (new), `admin-backend/src/index.ts` (modify)
  - Depends on: 1.2, 1.3
  - Acceptance: Plugin mounts all routes. MongoDB version detection sets `supportsWindowFields` flag correctly.

- [x] **Task 1.5**: Dashboard CRUD + query routes
  - Description: Create `admin-backend/src/dashboard/dashboardRoutes.ts`. All 7 routes: GET/POST/GET:id/PATCH:id/DELETE:id/POST query/GET sources. All require `IsAdmin`. ChartConfig validated at save time.
  - Files: `admin-backend/src/dashboard/dashboardRoutes.ts` (new), `admin-backend/src/index.ts` (modify)
  - Depends on: 1.3, 1.4
  - Acceptance: CRUD returns correct responses. `/query` with valid config returns `{data, meta}`. Unknown source → 400. Invalid ChartConfig → 400 with Zod errors. Non-admin → 403.

- [x] **Task 1.6**: Pipeline builder unit tests
  - Description: Write `admin-backend/src/dashboard/dashboardQueryEngine.test.ts`. Cover all filter types, all aggregations, all date trunc values, auto-bucketing, window field gating, countDistinct implementation.
  - Files: `admin-backend/src/dashboard/dashboardQueryEngine.test.ts` (new)
  - Depends on: 1.3
  - Acceptance: `bun run admin-backend:test` passes (29 tests). All branches covered.

---

### Phase 2: Frontend Components

- [x] **Task 2.1**: Add recharts + RTK hooks
  - Description: Add `recharts` to `admin-frontend/package.json`. Create `admin-frontend/src/useDashboardApi.ts` with all RTK Query hooks for dashboard CRUD, `/query` (as `build.query` for 60s caching), and `/sources`.
  - Files: `admin-frontend/package.json` (modify), `admin-frontend/src/useDashboardApi.ts` (new)
  - Depends on: 1.5
  - Acceptance: `recharts` importable. All hooks call correct endpoints.

- [x] **Task 2.2**: ChartWidget component
  - Description: Create `admin-frontend/src/ChartWidget.tsx`. All 14 chart types via Recharts. Loading/error/empty states. `React.memo`. Theme colors from `useTheme()`.
  - Files: `admin-frontend/src/ChartWidget.tsx` (new), `admin-frontend/src/index.tsx` (modify)
  - Depends on: 2.1
  - Acceptance: All 14 chart types render. States visible. Memoized correctly.

- [x] **Task 2.3**: DashboardList screen
  - Description: Create `admin-frontend/src/DashboardList.tsx`. Cards with title/description/widget count/updated. "Create New" button. Register as `customScreen` in `AdminApp` config response.
  - Files: `admin-frontend/src/DashboardList.tsx` (new), `admin-frontend/src/index.tsx` (modify), `admin-backend/src/adminApp.ts` (modify)
  - Depends on: 2.1
  - Acceptance: List renders. Empty state. "Dashboards" appears in admin nav.

- [x] **Task 2.4**: DashboardViewer screen
  - Description: Create `admin-frontend/src/DashboardViewer.tsx`. Parallel widget queries (one RTK call per widget). Per-widget loading/error. "Edit" and "Delete" buttons with confirmation modal.
  - Files: `admin-frontend/src/DashboardViewer.tsx` (new), `admin-frontend/src/index.tsx` (modify)
  - Depends on: 2.2, 2.3
  - Acceptance: Widgets load in parallel. Slow query only blocks that widget. Edit/delete work.

---

### Phase 3: Dashboard Builder

- [x] **Task 3.1**: Field picker and source selector
  - Description: Create `admin-frontend/src/builder/DataSourcePicker.tsx` and `admin-frontend/src/builder/FieldList.tsx`. Dimensions in blue-tinted style, measures in green-tinted style (Tableau convention).
  - Files: `admin-frontend/src/builder/DataSourcePicker.tsx` (new), `admin-frontend/src/builder/FieldList.tsx` (new)
  - Depends on: 2.1
  - Acceptance: Source picker lists all registered sources. Fields categorized by role with correct styling.

- [x] **Task 3.2**: Chart config form sub-components
  - Description: Create `ChartTypeSelector`, `AxisConfigForm`, `FilterBuilder`, `SortConfig` in `admin-frontend/src/builder/`. DateTrunc only for date fields. `runningTotal`/`rank` only when `supportsWindowFields` is true.
  - Files: `admin-frontend/src/builder/ChartTypeSelector.tsx` (new), `admin-frontend/src/builder/AxisConfigForm.tsx` (new), `admin-frontend/src/builder/FilterBuilder.tsx` (new), `admin-frontend/src/builder/SortConfig.tsx` (new)
  - Depends on: 3.1
  - Acceptance: Each sub-form renders. Conditional fields show/hide correctly.

- [x] **Task 3.3**: DashboardBuilder main component
  - Description: Create `admin-frontend/src/DashboardBuilder.tsx`. Full create/edit flow. Live preview with `isPreviewEnabled` gate. Widget list (add/reorder/delete). Save → navigate to viewer.
  - Files: `admin-frontend/src/DashboardBuilder.tsx` (new), `admin-frontend/src/index.tsx` (modify)
  - Depends on: 3.1, 3.2, 2.4
  - Acceptance: Full create flow works end-to-end. Live preview updates. Edit mode pre-populates. Reorder/delete work.

---

### Phase 4: AI Tools

- [x] **Task 4.1**: generateChart and createDashboard tools
  - Description: Create `admin-backend/src/dashboard/dashboardTools.ts`. Exports `createGenerateChartTool(options)` and `createDashboardTool(options)`. Strict Zod validation. `generateChart` runs query and returns `{chartConfig, data, meta}`. `createDashboard` saves Dashboard to DB and returns `{dashboardId, title, widgetCount}`.
  - Files: `admin-backend/src/dashboard/dashboardTools.ts` (new)
  - Depends on: 1.3, 1.4
  - Acceptance: Both return valid Vercel AI SDK `Tool` objects. Invalid input rejected by Zod. `createDashboard` writes to DB.

- [x] **Task 4.2**: Export createDashboardGptTools
  - Description: Export `createDashboardGptTools(options)` from `admin-backend/src/dashboard/index.ts` and `admin-backend/src/index.ts`. Returns `Record<string, Tool>` for use with `addGptRoutes`.
  - Files: `admin-backend/src/dashboard/index.ts` (new), `admin-backend/src/index.ts` (modify)
  - Depends on: 4.1
  - Acceptance: Tools integrate with `addGptRoutes` via `tools` option.

- [x] **Task 4.3**: Frontend: render charts from GPT tool results
  - Description: Create `admin-frontend/src/DashboardToolResult.tsx`. Detects `toolResult.result.chartConfig` → renders inline `ChartWidget` with `toolResult.result.data`. Detects `toolResult.result.dashboardId` → renders "View Dashboard →" link.
  - Files: `admin-frontend/src/DashboardToolResult.tsx` (new), `admin-frontend/src/index.tsx` (modify)
  - Depends on: 4.2, 2.2
  - Acceptance: Inline chart renders from GPT tool result. "View Dashboard" link appears for createDashboard result.

- [ ] **Task 4.4**: AI tool tests
  - Description: Write `admin-backend/src/dashboard/dashboardTools.test.ts`. Zod rejection tests. `generateChart` calls query engine. `createDashboard` creates DB record.
  - Files: `admin-backend/src/dashboard/dashboardTools.test.ts` (new)
  - Depends on: 4.1
  - Acceptance: `bun run admin-backend:test` passes. Invalid input rejection and DB write both covered.
