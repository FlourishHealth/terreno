# Task List: Admin Interface Overhaul (Django-Admin Parity)

*Structured task breakdown for automated implementation. Each task is independently implementable and testable. Phases are ordered; tasks within a phase often run in parallel.*

*Folded in from adversarial review:* tasks 1.0, 1.6a, 1.7a, 2.6a, 2.8a, 5.0, 6.0, 7.6, 7.7 are new. Tasks marked **(revised)** have updated descriptions or acceptance criteria.

## Phase 1 — Core API surface (`@terreno/api`)

- [ ] **Task 1.0 (NEW)**: Extend `TerrenoPlugin.register` signature additively
  - Description: Change `TerrenoPlugin.register(app, openApi?)` to `register(app, openApi?, terrenoApp?)` in `api/src/terrenoPlugin.ts`. Update the call site in `api/src/terrenoApp.ts:321` to `registration.register(app, oapi, this)`. Existing plugins ignore the new arg — verify each one (`HealthApp`, `BetterAuthApp`, `ConfigurationApp`, `FeatureFlagsApp`, `LangfuseApp`, `DocumentStorageApp`, `ConsentApp`) compiles. Similarly: rename `ModelRouterRegistration._buildWithOpenApi(openApi)` to `_buildWithContext({openApi, terrenoApp})` (internal API). Update `TerrenoApp.build()` accordingly. Add `setMaxListeners(50)` to TerrenoApp's emitter.
  - Files: `api/src/terrenoPlugin.ts`, `api/src/terrenoApp.ts`, `api/src/api.ts`
  - Depends on: none
  - Acceptance: Existing tests pass unchanged. A new test verifies a plugin's `register` receives the `TerrenoApp` instance as the third arg. `_buildWithContext` is the public-internal API; `_buildWithOpenApi` no longer exists.

- [ ] **Task 1.1**: Define admin types in `@terreno/api`
  - Description: Create `api/src/adminTypes.ts` exporting `AdminConfig`, `AdminFilter`, `AdminFieldset`, `AdminFieldOverride`, `AdminAction`, `AdminContribution`, `AdminModelContribution`, `AdminCustomScreen`, `AdminHomeWidgetContribution`, `AdminHomeConfig`, `AdminHomeWidgetSpec`, `AdminChangeEvent`. These live in `api` (not `admin-backend`) so plugins can declare contributions without depending on `admin-backend`. No runtime code yet — types only.
  - Files: `api/src/adminTypes.ts`, `api/src/index.ts` (re-export)
  - Depends on: none
  - Acceptance: Types import successfully into `admin-backend`, `feature-flags`, and a new test file. No type errors across the monorepo (`bun run compile`).

- [ ] **Task 1.2**: Extend `ModelRouterOptions` with `admin?: AdminConfig`
  - Description: Add the optional `admin` field to `ModelRouterOptions` in `api/src/api.ts`. No runtime use yet — it's a passthrough that consumers (AdminApp) read off the registration. Update both `modelRouter` signatures (Router and Registration). Type only — no behavioral change.
  - Files: `api/src/api.ts`
  - Depends on: 1.1
  - Acceptance: Existing example-backend compiles unchanged. Adding `admin: {displayName: "X", listDisplay: ["name"]}` to a `modelRouter` call typechecks.

- [ ] **Task 1.3**: `TerrenoApp` registration accessors
  - Description: Add `getRegistrations(): ModelRouterRegistration[]` and `getPlugins(): TerrenoPlugin[]` to `TerrenoApp` in `api/src/terrenoApp.ts`. AdminApp will call these from its own `register()` to discover admin contributions. Do not change existing behavior.
  - Files: `api/src/terrenoApp.ts`, `api/src/terrenoApp.test.ts` (add accessor tests)
  - Depends on: none
  - Acceptance: Test verifies `app.getRegistrations()` returns each registered router and `getPlugins()` returns each registered plugin.

- [ ] **Task 1.4**: `TerrenoPlugin.adminContribution?()` interface addition
  - Description: Add `adminContribution?(): AdminContribution` to the `TerrenoPlugin` interface in `api/src/terrenoPlugin.ts`. Optional — no existing plugins are affected.
  - Files: `api/src/terrenoPlugin.ts`
  - Depends on: 1.1
  - Acceptance: Existing plugins (`FeatureFlagsApp`, `ConsentApp`, `DocumentStorageApp`, `LangfuseApp`, `BetterAuthApp`, `api-health`) compile unchanged.

- [ ] **Task 1.5**: Typed event bus on `TerrenoApp`
  - Description: Add `on(event, listener)`, `off(event, listener)`, and internal `emit(event, payload)` to `TerrenoApp`. First event is `"admin:model.changed"` with the `AdminChangeEvent` payload. Implement as a small wrapper around node's `EventEmitter` typed via overloads. No transport — just an in-process bus.
  - Files: `api/src/terrenoApp.ts`, `api/src/terrenoApp.test.ts`
  - Depends on: 1.1
  - Acceptance: Tests verify (a) listeners receive emitted events, (b) `off` removes them, (c) typing prevents emitting unknown event names.

- [ ] **Task 1.6 (revised)**: `modelRouter` emits scrubbed `admin:model.changed` when `admin.realtime` is true
  - Description: Inside `_buildWithContext({openApi, terrenoApp})`, wrap the existing `postCreate`/`postUpdate`/`postDelete` to additionally call `terrenoApp.emit("admin:model.changed", scrubbedEvent)` when `options.admin?.realtime === true`. Crucially: scrub the event's `document` field through a shared helper that strips both `admin.excludeFields` and `admin.hiddenFields` (same logic as `removeHiddenFields` in `admin-backend/src/adminApp.ts:132`; lift it into `api/src/api.ts` or a shared util). For delete events, omit `document` entirely. Event payload: `{type, modelName, routePath, documentId, document?, user: {id}, at}`.
  - Files: `api/src/api.ts`, `api/src/scrubAdminFields.ts` (NEW), `api/src/terrenoApp.ts`, `api/src/api.test.ts`
  - Depends on: 1.0, 1.2, 1.5
  - Acceptance: Test with `admin: {realtime: true, excludeFields: ["hash"]}` on a User-like model verifies events fire and the emitted `document` payload contains no `hash`. With `realtime: false`, no event. Delete event omits `document`.

- [ ] **Task 1.6a (NEW)**: Shared scrub helper for excludeFields/hiddenFields with population
  - Description: Build the `scrubAdminFields(value, model, adminConfig, allModelAdmins)` helper. Recursive: when scrubbing a populated ref, look up the referenced model in `allModelAdmins` and apply *its* exclude+hidden union. If the referenced model has no admin config, return populated value as-is. Used by Task 1.6 emit AND by AdminApp's response handler (replaces today's `removeHiddenFields` in admin-backend/src/adminApp.ts:132).
  - Files: `api/src/scrubAdminFields.ts`, `api/src/scrubAdminFields.test.ts`
  - Depends on: 1.1
  - Acceptance: Tests cover (a) top-level scrub, (b) nested arrays, (c) populated docs scrubbed by their own admin config, (d) unconfigured populated docs returned untouched.

- [ ] **Task 1.7 (revised)**: `readonlyFields` server-side enforcement on ALL body-accepting routes
  - Description: Install a body-scrubbing middleware that drops `readonlyFields` keys from `req.body` for every body-accepting admin route — i.e., POST `/` (create), PATCH `/:id` (update), AND the array sub-routes `POST /:id/:field`, `PATCH /:id/:field/:itemId`, `DELETE /:id/:field/:itemId` (api/src/api.ts:1160-1174). Note POST `/` is a create — `readonlyFields` typically gates updates only, so make it config-driven: `readonlyFields` applies to PATCH+array sub-routes by default; `readonlyOnCreate?: boolean` (defaults false) gates the create path. Add a debug log when fields are dropped.
  - Files: `api/src/api.ts`, `api/src/api.test.ts`
  - Depends on: 1.0, 1.2
  - Acceptance: PATCH with `{created: "..."}` on a model with `readonlyFields: ["created"]` does not change the value. POST `/:id/checkboxes` with a body that includes a readonly key strips it. `readonlyOnCreate: true` causes POST `/` to also strip.

- [ ] **Task 1.7a (NEW)**: `excludeFields` enforcement extends through `populatePaths` in responses
  - Description: When `removeHiddenFields` (now `scrubAdminFields`) processes a response, recursively apply each populated model's exclude+hidden set. Wired via AdminApp's response handler (which has access to the aggregated `allModelAdmins` map). Models without an admin config are passed through.
  - Files: `admin-backend/src/adminApp.ts`, `admin-backend/src/adminApp.test.ts`
  - Depends on: 1.6a, 2.2
  - Acceptance: A `Todo` admin populates `ownerId` → User. User admin has `excludeFields: ["hash", "salt"]`. GET `/admin/todos/:id` response's populated `ownerId.hash` is absent.

- [ ] **Task 1.8**: `excludeFields` server-side enforcement
  - Description: Treat `admin.excludeFields` as a superset of `hiddenFields`: stripped from POST + PATCH bodies AND from list + detail responses. Existing `hiddenFields` continues to work and merges with `excludeFields` (union).
  - Files: `api/src/api.ts`, `api/src/api.test.ts`
  - Depends on: 1.2
  - Acceptance: A model with `excludeFields: ["hash"]` never includes `hash` in any admin response, and a POST/PATCH attempting to set `hash` does not persist it.

## Phase 2 — Admin backend aggregation

- [ ] **Task 2.1**: Legacy `AdminModelConfig` adapter
  - Description: Create `admin-backend/src/legacy.ts` that converts the old shape (`{model, routePath, displayName, listFields, defaultSort, fieldOverrides, fieldOrder, hiddenFields}`) into an `AdminModelContribution` (with `admin: AdminConfig`). Emit exactly one deprecation warning per legacy entry per process: `[admin] AdminApp.models entry "<displayName>" uses the legacy shape (...). Migrate to modelRouter({admin: {...}}) — see docs/how-to/admin-add-model.md`. Use a `Set<string>` to dedupe.
  - Files: `admin-backend/src/legacy.ts`, `admin-backend/src/legacy.test.ts`
  - Depends on: 1.1
  - Acceptance: `convertLegacy({model, listFields: ['email']})` returns an equivalent `AdminModelContribution`. Same input twice → warning logged once. Both `listFields` and `defaultSort` map to `listDisplay` and `ordering`.

- [ ] **Task 2.2**: Aggregate admin contributions from registered routers + plugins + legacy `models`
  - Description: Rewrite `AdminApp.register()` to collect admin contributions from three sources: (a) `options.models` (legacy, run through the adapter), (b) `parentApp.getRegistrations()` filtered for those with `options.admin`, (c) `parentApp.getPlugins()` calling `adminContribution()` on each. Dedupe by `routePath` with precedence host > plugin > registered. Build a single internal `AdminModelContribution[]` to drive everything downstream.
  - Files: `admin-backend/src/adminApp.ts`, `admin-backend/src/adminApp.test.ts`
  - Depends on: 1.3, 1.4, 2.1
  - Acceptance: Test with a `TerrenoApp` that has (a) one modelRouter with `admin:`, (b) a plugin that returns `{models: [...]}` from `adminContribution()`, (c) an AdminApp with legacy `models: [...]`. `/admin/config` returns all three with no duplicates and the right precedence.

- [ ] **Task 2.3**: Aggregate `customScreens`, `homeWidgets`, `widgetIds`, `scripts` from plugin contributions
  - Description: Extend `AdminApp` aggregation to merge `customScreens`, `homeWidgets` (yielding `widgetIds`), and `scripts` from all plugin `adminContribution()` returns. Combine with `AdminApp`'s own `scripts` and existing `customScreens` from options. Host's `home.widgets` ordering wins; plugin widgets only surface if listed.
  - Files: `admin-backend/src/adminApp.ts`, `admin-backend/src/adminApp.test.ts`
  - Depends on: 2.2
  - Acceptance: A plugin contributing `{customScreens: [{name: "x"}], homeWidgets: [{id: "w"}]}` causes `/admin/config` to include those entries. Host without `home.widgets: ["w"]` does *not* surface the widget by default.

- [ ] **Task 2.4**: Extend `/admin/config` response shape
  - Description: Update `AdminConfigResponse` to include the new fields (per `AdminModelMeta`: `listDisplay`, `listDisplayLinks`, `searchFields`, `sortableFields`, `ordering`, `pageSize`, `filters`, `fieldsets`, `readonlyFields`, `autocompleteFields`, `actions`, `permissions`, `realtime`, `group`, `icon`). At the top level: `home`, `widgetIds`, `capabilities`. Continue emitting `listFields` and `defaultSort` as deprecated aliases for one release.
  - Files: `admin-backend/src/adminApp.ts`, `admin-backend/src/adminApp.test.ts`
  - Depends on: 2.2
  - Acceptance: GET /admin/config returns the extended shape. Snapshot test covers the response. `listFields === listDisplay` and `defaultSort === ordering` for back-compat.

- [ ] **Task 2.5**: Per-action permission booleans in `/admin/config`
  - Description: For each model, evaluate the current user against `adminPermissions.{list,read,create,update,delete}` (falling back to `IsAdmin`) and emit booleans in the config response. Same for each action's `permissions`. `/admin/config` is per-user — set `Cache-Control: private, no-store`.
  - Files: `admin-backend/src/adminApp.ts`, `admin-backend/src/adminApp.test.ts`
  - Depends on: 2.4
  - Acceptance: Two users with different permissions receive different `permissions` blocks. `Cache-Control: private, no-store` header present.

- [ ] **Task 2.6 (revised)**: Filter parser — per-type strict shape
  - Description: Create `admin-backend/src/filterParser.ts`. Function `parseFilters(query, filters: AdminFilter[]): {filter: FilterQuery<any>, errors: {[k: string]: string}}`. Each declared `AdminFilter.type` accepts EXACTLY one value shape (see "Filter param parsing" in the IP); anything else returns a 400 with field-level errors. Mongo operator keys (`$ne`, `$gt`, `$where`, `$regex`, `$in`, …) NEVER pass through — they are detected by key prefix `$` and rejected. Prototype-pollution attempts (`__proto__`, `constructor`, `prototype` as keys) dropped silently and logged at warn level. Fields not declared in `admin.filters[]` ignored.
  - Files: `admin-backend/src/filterParser.ts`, `admin-backend/src/filterParser.test.ts`
  - Depends on: 1.1
  - Acceptance: Test matrix covers:
    - boolean: accepts `"true"`/`"false"`, rejects arrays / `"yes"` / objects
    - text: accepts scalar string, rejects arrays / objects
    - choice: accepts declared values, rejects unknown values / arrays / objects
    - ref: accepts valid ObjectId, rejects non-ObjectId / arrays / objects
    - date: accepts ISO string, rejects arrays / objects / malformed
    - dateRange: accepts `{gte, lte}` only with optional keys, rejects scalars / arrays / extra keys / non-ISO values
    - Operator injection: `filter[role][$ne]=admin`, `filter[role][$where]=...`, `filter[role][$regex]=...` all return 400
    - Prototype pollution: `filter[__proto__][toString]=...`, `filter[constructor][prototype][toString]=...` dropped silently, warn-logged
    - Undeclared field: `filter[ssn]=123` silently ignored, no 400

- [ ] **Task 2.7 (revised)**: Wire filter parser, `sortableFields`, and shared search helper
  - Description: In the admin's internal modelRouter creation, the modelRouter's `queryFilter` becomes an async adapter that awaits `adminFilter(req)` and merges with the parsed filter object. Validate `?sort=` against `sortableFields` (400 on unknown). Build a single `runSearch(model, q, searchFields)` helper used by both the list endpoint (`?q=`) and the existing `/search` endpoint — the two no longer have separate implementations. The list endpoint inlines search-as-filter using `$or` over `searchFields` (or `_id` for valid ObjectIds), avoiding a separate round-trip.
  - Files: `admin-backend/src/adminApp.ts`, `admin-backend/src/runSearch.ts` (NEW; extract from existing /search code), `admin-backend/src/adminApp.test.ts`
  - Depends on: 2.6
  - Acceptance: `GET /admin/users?filter[admin]=true&q=alice&sort=-created&pageSize=10` returns matching admin users named "alice", sorted newest first, 10 per page, with no extra DB round-trip beyond list + count. Unknown sort field → 400. `?filter[ssn]=...` (undeclared) ignored. `adminFilter` invoked once per request and properly awaited.

- [ ] **Task 2.8 (revised)**: Action runner endpoint with frozen `AdminActionContext`
  - Description: Create `admin-backend/src/actionRunner.ts`. Mount `POST /admin/{routePath}/actions/:actionName` per model with declared actions. Validate body `{ids: string[]}` — reject `ids.length > MAX_ACTION_IDS` (default 1000) with HTTP 413. Look up action by name. Run `action.permissions` (or fall back to `adminPermissions.update`). Validate ids via ONE round-trip: `Model.find({_id: {$in: ids}, ...resolvedAdminFilter}).select("_id")`. Silently drop ids that don't pass; pass the survivors into `ctx.ids`. Build a frozen `AdminActionContext` (no live `req`). If `action.background: true`: persist the context onto a `BackgroundTask`, return `{taskId}`. Else invoke `action.run(ctx)` synchronously and return `{updatedIds?, message?, results?}`. Wrap errors → `APIError`.
  - Files: `admin-backend/src/actionRunner.ts`, `admin-backend/src/actionRunner.test.ts`, `admin-backend/src/adminApp.ts` (mount routes)
  - Depends on: 2.2, 2.8a
  - Acceptance: Sync action: returns updated rows. Background action: returns `{taskId}`, runner picks it up later, `GET /admin/scripts/tasks/:id` reports progress. Permission denied → 403. `ids.length > 1000` → 413. ids outside `adminFilter` scope are silently excluded from `ctx.ids` (action sees fewer rows than the user selected — caller decides whether to warn). Background runner does NOT use the live `req`.

- [ ] **Task 2.8a (NEW)**: `AdminActionContext` type + `BackgroundTask` snapshot persistence
  - Description: Define `AdminActionContext<T>` in `api/src/adminTypes.ts` (per the IP). Extend `BackgroundTask` to carry an opaque `actionContext` field (JSON) for background-action runs. The background runner deserializes the context and invokes `action.run(ctx)` outside the request lifecycle. Provide a tagged logger constructed from `{actionName, requestId, userId}`.
  - Files: `api/src/adminTypes.ts`, `api/src/api.ts` (BackgroundTask schema extension), tests
  - Depends on: 1.1
  - Acceptance: A background action launched from request A and a background action launched from request B never see each other's context. Re-running `action.run` after the request closes does not crash (no `req.headers` access, etc.).

- [ ] **Task 2.9 (revised)**: `routePath` normalization + collision precedence (registered > plugin > legacy)
  - Description: Trailing-slash normalization so `/users` and `/users/` are treated identically. Collision precedence: **registered modelRouter beats plugin contribution beats legacy `AdminApp.models`**. The most-specific source wins; legacy is purely additive. Two registered modelRouters with the same `routePath` is a fatal misconfiguration — throw at `AdminApp.register()` time with a clear message naming both registrations. Warn on plugin-vs-legacy and plugin-vs-registered collisions where the resolution is unambiguous.
  - Files: `admin-backend/src/adminApp.ts`, `admin-backend/src/adminApp.test.ts`
  - Depends on: 2.2
  - Acceptance: Two registered routers with `/users` → throw. Registered `/users` + plugin `/users` → registered wins, warn-logged. Plugin `/users` + legacy `/users` → plugin wins, warn-logged.

- [ ] **Task 2.10**: Export new types from `admin-backend`
  - Description: Export `AdminApp`, `AdminContribution` (re-export from `api`), `AdminAction`, `AdminFilter`, `AdminFieldset` types from `admin-backend/src/index.ts`. Mark `AdminModelConfig` (legacy) and `AdminFieldOverride` for deprecation but keep exporting.
  - Files: `admin-backend/src/index.ts`
  - Depends on: 2.2
  - Acceptance: Consumers import `AdminAction` etc. without going through `@terreno/api`.

## Phase 3 — Admin frontend foundations

- [ ] **Task 3.1 (revised)**: `AdminProvider` context with locked three-bucket widget registry
  - Description: Create `admin-frontend/src/AdminProvider.tsx`. Context value `{ api, baseUrl, widgets: AdminWidgetRegistry, socket?: SocketLike }` where `AdminWidgetRegistry` is the three-bucket shape from the IP: `{ fields: Record<string, FieldWidgetComponent>; home: Record<string, HomeWidgetComponent>; screens: Record<string, ScreenWidgetComponent> }`. The three bucket types have distinct prop contracts:
    - `FieldWidgetComponent<TValue>`: `{value, onChange, fieldMeta, disabled, errorText, testID}`
    - `HomeWidgetComponent`: `{config?: unknown, modelMetas: AdminModelMeta[]}`
    - `ScreenWidgetComponent`: `{name, displayName, params?: Record<string, string>}`
    Provide `useAdminContext()` hook + sub-hooks `useFieldWidget(name)`, `useHomeWidget(name)`, `useScreenWidget(name)` that return a "MissingWidget" placeholder + one-time `console.warn` when the key isn't registered.
  - Files: `admin-frontend/src/AdminProvider.tsx`, `admin-frontend/src/AdminProvider.test.tsx`, `admin-frontend/src/types.ts`
  - Depends on: none
  - Acceptance: All three sub-hooks return registered components when present; return a placeholder component when missing and warn exactly once per (bucket, name) pair. `useAdminContext` throws with helpful message outside provider.

- [ ] **Task 3.2**: Frontend `AdminConfigResponse` types
  - Description: Mirror the backend's extended `AdminConfigResponse` in `admin-frontend/src/types.ts`. Include `capabilities` so screens can fail soft against older backends.
  - Files: `admin-frontend/src/types.ts`
  - Depends on: 2.4
  - Acceptance: Types compile; `useAdminConfig` returns the extended shape.

- [ ] **Task 3.3 (revised)**: `AdminScreenRouter`
  - Description: Create `admin-frontend/src/AdminScreenRouter.tsx`. Takes a `name` prop (the URL segment). Reads `/admin/config`, looks up: (a) if `name` matches a `customScreen`, render the registered widget from `useScreenWidget(name)`; (b) else if it matches a model `name`, render `AdminModelTable`. Falls back to a NotFound state with a helpful message ("No model or custom screen named X — did you forget to register the widget component in AdminProvider.widgets.screens?").
  - Files: `admin-frontend/src/AdminScreenRouter.tsx`, `admin-frontend/src/AdminScreenRouter.test.tsx`
  - Depends on: 3.1, 3.2, 2.3
  - Acceptance: Render with a model name → table appears. Render with a customScreen name + registered widget → widget appears. Unknown name → helpful error.

- [ ] **Task 3.4**: `AdminHome` widget-driven home page
  - Description: Create `admin-frontend/src/AdminHome.tsx`. Reads `home.widgets` from `/admin/config`. For each entry: (a) `{type: "..."}` → built-in widget by type; (b) `"plugin-widget-id"` → lookup in `AdminProvider.widgets`; (c) React component → render directly. Layout: grid by default. Fall back to a single `modelsGrid` widget (the legacy layout) when `home` is absent.
  - Files: `admin-frontend/src/AdminHome.tsx`, `admin-frontend/src/AdminHome.test.tsx`
  - Depends on: 3.1, 3.2
  - Acceptance: With no `home` config → legacy grid renders. With `home.widgets: [{type:"modelStats", models:["User"]}, "feature-flags-overrides"]` → both render in order. Unknown widget id → console warning, skipped silently.

- [ ] **Task 3.5**: Built-in `ModelsGridWidget` (legacy grid)
  - Description: Lift the existing `AdminModelList` grid logic into `admin-frontend/src/widgets/ModelsGridWidget.tsx`. Renders one card per model from `/admin/config`. Click → navigate to `/admin/{name}`. Optionally filter by `group` prop.
  - Files: `admin-frontend/src/widgets/ModelsGridWidget.tsx`, `admin-frontend/src/widgets/ModelsGridWidget.test.tsx`
  - Depends on: 3.2
  - Acceptance: Renders all models with field counts. `group="Identity"` shows only Users in the example app.

- [ ] **Task 3.6**: Built-in `ModelStatsWidget`
  - Description: For each model in `models` prop, run `useListQuery({pageSize: 1, page: 1})` and display the total count plus model display name + link. Loading shimmer state. Error fallback shows the model name with `—`.
  - Files: `admin-frontend/src/widgets/ModelStatsWidget.tsx`, `admin-frontend/src/widgets/ModelStatsWidget.test.tsx`
  - Depends on: 3.1, 3.2
  - Acceptance: Renders counts for the configured models; empty models prop → renders nothing.

- [ ] **Task 3.7**: Built-in `RecentActivityWidget`
  - Description: For each model in `models` (default: all), fetch `?sort=-updated&pageSize=limit/N&page=1` and interleave the results sorted by `updated`. Show a short row per item: model display name + a chosen `listDisplay` field + relative time (Luxon).
  - Files: `admin-frontend/src/widgets/RecentActivityWidget.tsx`, `admin-frontend/src/widgets/RecentActivityWidget.test.tsx`
  - Depends on: 3.1, 3.2
  - Acceptance: With `limit: 5` and three models, shows 5 most-recently-updated items across the three.

- [ ] **Task 3.8**: Built-in `ScriptRunnerWidget`
  - Description: Compact replacement for `AdminScriptList` on the home page: just the script name + a Run button that opens the existing `AdminScriptRunModal`.
  - Files: `admin-frontend/src/widgets/ScriptRunnerWidget.tsx`, `admin-frontend/src/widgets/ScriptRunnerWidget.test.tsx`
  - Depends on: 3.1
  - Acceptance: Renders the scripts from `/admin/config`; clicking Run opens the existing modal and the script executes.

- [ ] **Task 3.9**: Built-in `CustomScreensListWidget`
  - Description: Renders one card per `customScreen` from `/admin/config`, navigating to `/admin/{name}`.
  - Files: `admin-frontend/src/widgets/CustomScreensListWidget.tsx`, `admin-frontend/src/widgets/CustomScreensListWidget.test.tsx`
  - Depends on: 3.2
  - Acceptance: Renders DocumentStorage and any plugin-contributed custom screens.

- [ ] **Task 3.10**: `AdminFieldRenderer` reads widgets from context
  - Description: Replace the hardcoded widget switch in `AdminFieldRenderer.tsx`. Read the widget map from `useAdminContext().widgets.fields`. If `fieldConfig.widget` is set and present in the map → render that. Else fall back to the existing type-based rendering. Same change in `AdminModelForm.tsx` for form-side widget lookup.
  - Files: `admin-frontend/src/AdminFieldRenderer.tsx`, `admin-frontend/src/AdminModelForm.tsx`, `admin-frontend/src/AdminFieldRenderer.test.tsx`
  - Depends on: 3.1
  - Acceptance: Registering `widgets={{fields: {markdown: MyMarkdownEditor}}}` causes a field with `widget: "markdown"` to use `MyMarkdownEditor`. Unregistered widget → falls back to default with a one-time `console.warn`.

- [ ] **Task 3.11**: Keep `AdminModelList` working as a thin compatibility wrapper
  - Description: Reduce `AdminModelList.tsx` to render `<AdminHome widgets={[{type:"modelsGrid"}, {type:"scriptRunner"}, {type:"customScreensList"}]} />` (or a minimal equivalent). Preserve the existing `customScreens` prop by logging a deprecation warning when present + `AdminProvider` widgets aren't used. Document removal target as next major.
  - Files: `admin-frontend/src/AdminModelList.tsx`
  - Depends on: 3.4, 3.5, 3.8, 3.9
  - Acceptance: Existing consumers (example-frontend's `app/admin/index.tsx`) render unchanged. Deprecation warning fires once if `customScreens` prop is set.

- [ ] **Task 3.12**: Frontend package exports
  - Description: Update `admin-frontend/src/index.tsx` to export: `AdminProvider`, `AdminScreenRouter`, `AdminHome`, all built-in widgets, the widget registry types, and a `BUILT_IN_WIDGETS` object so consumers can spread it: `widgets={{fields: {...BUILT_IN_FIELD_WIDGETS, ...mine}, home: {...BUILT_IN_HOME_WIDGETS, ...mine}}}`.
  - Files: `admin-frontend/src/index.tsx`
  - Depends on: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
  - Acceptance: `import {AdminProvider, AdminHome, AdminScreenRouter, BUILT_IN_FIELD_WIDGETS} from "@terreno/admin-frontend"` works.

## Phase 4 — Admin frontend feature lift

- [ ] **Task 4.1 (revised)**: Search box in `AdminModelTable`
  - Description: Add a debounced search input at the top of the table when `modelMeta.searchFields.length > 0`. Surfaces as `?q=` query param. Show "Searching X, Y, Z" helper text. Reset to page 1 on change. Add `testID="admin-table-search"` to the input. Debounce is 250ms (constant `ADMIN_SEARCH_DEBOUNCE_MS` in admin-frontend/src/Constants.ts).
  - Files: `admin-frontend/src/AdminModelTable.tsx`, `admin-frontend/src/Constants.ts`, `admin-frontend/src/AdminModelTable.test.tsx`
  - Depends on: 2.7, 3.2
  - Acceptance: Typing in the search box waits 250ms, fires one request with `?q=`. Empty box hides search hits. Clearing → resets to unsearched list. `getByTestId("admin-table-search")` works.

- [ ] **Task 4.2 (revised)**: `AdminFilterDrawer`
  - Description: Right-side collapsible drawer rendered when `modelMeta.filters.length > 0`. Renders one input per filter type:
    - `boolean` → BooleanField (toggle) — `testID="admin-filter-{field}"`
    - `text` → TextField — `testID="admin-filter-{field}"`
    - `choice` → SelectField — `testID="admin-filter-{field}"`
    - `ref` → AdminRefField in autocomplete mode — `testID="admin-filter-{field}"`
    - `date` → DateTimeField (single) — `testID="admin-filter-{field}"`
    - `dateRange` → two DateTimeFields — `testID="admin-filter-{field}-gte"` / `"admin-filter-{field}-lte"`
    State serialized as `filter[k]=v` (range as `filter[k][gte]=` / `[lte]=`). Apply button (`testID="admin-filter-apply"`) updates the list query. On mobile (`<md`) → bottom-sheet via existing `ActionSheet` pattern (`testID="admin-filter-sheet"`). Drawer root `testID="admin-filter-drawer"`.
  - Files: `admin-frontend/src/AdminFilterDrawer.tsx`, `admin-frontend/src/AdminFilterDrawer.test.tsx`, `admin-frontend/src/AdminModelTable.tsx` (mount)
  - Depends on: 3.2
  - Acceptance: Selecting "admin: true" in the drawer narrows the list. Combining filters AND-narrows server-side. Drawer collapses/expands via header toggle. Mobile viewport → sheet. All testIDs accessible.

- [ ] **Task 4.3 (revised)**: Bulk-select column + select-all
  - Description: Add a leading checkbox column to `AdminModelTable`. Header checkbox (`testID="admin-table-select-all"`) toggles all rows on the current page. Row checkboxes have `testID="admin-table-row-checkbox-{id}"`. Selected row count shown above the table (`testID="admin-table-selection-count"`). Maintain selected ids across pagination, BUT clear selection on filter change, search change, OR sort change.
  - Files: `admin-frontend/src/AdminModelTable.tsx`, `admin-frontend/src/AdminModelTable.test.tsx`
  - Depends on: none
  - Acceptance: Selecting 3 rows shows "3 selected". Header checkbox toggles current page. Filter / search / sort change clears selection. testIDs queryable.

- [ ] **Task 4.4 (revised)**: `AdminActionMenu` + action invocation
  - Description: Dropdown (`testID="admin-action-menu"`) above the table next to the selection count when `modelMeta.actions.length > 0`. Disabled when no rows selected. On select: show confirmation modal (`testID="admin-action-confirm-{name}"`) with `action.confirm` if set. POST `{ids}` to `/admin/{routePath}/actions/:name`. For sync actions: toast success + refetch list. For `background: true`: open `AdminScriptRunModal` with the returned `taskId`. Hide actions where `modelMeta.actions[i].allowed === false`.
  - Files: `admin-frontend/src/AdminActionMenu.tsx`, `admin-frontend/src/AdminActionMenu.test.tsx`, `admin-frontend/src/AdminModelTable.tsx` (mount)
  - Depends on: 2.8, 4.3
  - Acceptance: Selecting 2 rows and running "Activate" → POST fires with both ids, success toast, list refetches. Selecting a background action → modal opens with progress. Confirmation modal renders `action.confirm` text. `allowed: false` action does not render.

- [ ] **Task 4.5**: `sortableFields` and `pageSize` enforcement in the table
  - Description: Column headers are only sortable for fields in `modelMeta.sortableFields`. Use `modelMeta.pageSize` as the default if no override is in URL state.
  - Files: `admin-frontend/src/AdminModelTable.tsx`, `admin-frontend/src/AdminModelTable.test.tsx`
  - Depends on: 3.2
  - Acceptance: Click on a non-sortable column header is a no-op (cursor: default). Page size defaults to `modelMeta.pageSize`.

- [ ] **Task 4.6**: `fieldsets` in `AdminModelForm`
  - Description: When `modelMeta.fieldsets` is set, render the form as one collapsible Accordion section per fieldset (using existing `Accordion` from `@terreno/ui`). Honor `collapsed` (default expanded) and `description` (rendered under the fieldset title). `fieldOrder` continues to work when `fieldsets` is absent.
  - Files: `admin-frontend/src/AdminModelForm.tsx`, `admin-frontend/src/AdminModelForm.test.tsx`
  - Depends on: 3.2
  - Acceptance: A model with 3 fieldsets renders 3 collapsible groups in the configured order. Fields outside any fieldset render in an "Other" section at the bottom.

- [ ] **Task 4.7**: `readonlyFields` in `AdminModelForm`
  - Description: Fields in `modelMeta.readonlyFields` are rendered as `disabled` form fields (display only). Show a small "read-only" badge next to the label. Already enforced server-side (Task 1.7).
  - Files: `admin-frontend/src/AdminModelForm.tsx`, `admin-frontend/src/AdminModelForm.test.tsx`
  - Depends on: 3.2
  - Acceptance: `readonlyFields: ["created"]` → the `created` field is visible but disabled with the badge.

- [ ] **Task 4.8**: Autocomplete refs (`autocompleteFields`)
  - Description: When a ref field is listed in `modelMeta.autocompleteFields`, render `AdminRefField` in async-search mode (debounced query against `/search?q=&fields=...` on the referenced model). Default behavior (fetch-all-and-dropdown) is preserved for refs not in the list.
  - Files: `admin-frontend/src/AdminRefField.tsx`, `admin-frontend/src/AdminRefField.test.tsx`
  - Depends on: 2.7, 3.2
  - Acceptance: With `autocompleteFields: ["organizationId"]`, typing fires `/search` requests; results render in the dropdown. Without it, the field uses a full prefetch dropdown as today.

- [ ] **Task 4.9**: Per-action permission hiding in the UI
  - Description: Honor `modelMeta.permissions.{create,update,delete}` booleans from `/admin/config`. Hide "Create New" if `permissions.create === false`. Hide actions whose `allowed === false`. Hide row delete if `permissions.delete === false`.
  - Files: `admin-frontend/src/AdminModelTable.tsx`, `admin-frontend/src/AdminModelForm.tsx`, `admin-frontend/src/AdminActionMenu.tsx`
  - Depends on: 2.5, 4.4
  - Acceptance: A user without create permission sees no "Create New" button in the table.

## Phase 5 — Pre-built admin migrations

- [ ] **Task 5.0 (NEW)**: Decide FeatureFlagOverridesWidget (and other plugin frontend widgets) shipping location
  - Description: `feature-flags/` is backend-only today. The plugin's frontend admin widget needs a home. Decide between (a) ship a separate `@terreno/feature-flags-frontend` package that exports React components — adds a build target and a new package, but the dependency arrow points correctly (admin-frontend ← feature-flags-frontend); (b) host plugin-frontend widgets inside `@terreno/admin-frontend/src/widgets/` and have admin-frontend depend on feature-flags' types — admin-frontend grows knowledge of every plugin, but it's one package. Document the choice in `docs/explanation/admin-plugin-frontend.md`. For v1 we pick option (b) to avoid the build-config churn; revisit if a third-party plugin appears.
  - Files: `docs/explanation/admin-plugin-frontend.md` (NEW)
  - Depends on: none
  - Acceptance: Decision recorded; Tasks 5.2 / 5.4 / 5.5 reference it.

- [ ] **Task 5.1 (revised)**: `FeatureFlagsApp.adminContribution()` + safe legacy-export deprecation
  - Description: Implement `adminContribution()` on `FeatureFlagsApp` returning the FeatureFlag model admin. Include `homeWidgets: [{id: "feature-flags-overrides", displayName: "Flag Overrides", icon: "flag"}]`. Keep `register()` unchanged. For the bare `featureFlagAdminConfig` export (`feature-flags/src/featureFlagModel.ts:157`, re-exported from `feature-flags/src/index.ts:2`): wrap with a `Proxy` that logs `[feature-flags] featureFlagAdminConfig is deprecated. Use new FeatureFlagsApp() and register it with TerrenoApp — see docs/how-to/admin-import-prebuilt.md` on first property access (once per process via WeakSet). Plan removal in the next major.
  - Files: `feature-flags/src/featureFlagsApp.ts`, `feature-flags/src/featureFlagModel.ts` (Proxy wrap), `feature-flags/src/featureFlagsApp.test.ts`
  - Depends on: 1.4, 2.2, 5.0
  - Acceptance: `new FeatureFlagsApp(...)` registered on `TerrenoApp` causes `/admin/config` to include the FeatureFlag model + the home widget id, with no manual host wiring. Reading `featureFlagAdminConfig.listFields` logs the deprecation warning exactly once across a process.

- [ ] **Task 5.2**: `FeatureFlagOverridesWidget` (frontend)
  - Description: A home-page widget that lists current feature-flag overrides for the logged-in user with a quick toggle. Lives in a frontend-shipping location (either `feature-flags/src/frontend.tsx` if the package goes isomorphic, or a sibling `feature-flags-frontend` package — pick to match existing project convention; if unclear, put it in `admin-frontend/src/widgets/FeatureFlagOverridesWidget.tsx` for v1). Register under the id `"feature-flags-overrides"` in a `FEATURE_FLAGS_ADMIN_WIDGETS` export.
  - Files: `admin-frontend/src/widgets/FeatureFlagOverridesWidget.tsx`, `admin-frontend/src/widgets/FeatureFlagOverridesWidget.test.tsx`, `admin-frontend/src/index.tsx`
  - Depends on: 3.1, 5.1
  - Acceptance: Adding `"feature-flags-overrides"` to `home.widgets` renders the widget. Spreading `FEATURE_FLAGS_ADMIN_WIDGETS` into the provider's `widgets.home` map makes it resolvable.

- [ ] **Task 5.3**: `ConsentApp.adminContribution()`
  - Description: Implement `adminContribution()` on `ConsentApp` to return ConsentForm and ConsentResponse admins (currently configured in `example-backend/src/server.ts`). Include `widgetComponents` field-widgets: `locale-content`, `locale-default`, `checkbox-list` (the components already exist in `admin-frontend/src` — re-export them under known keys).
  - Files: wherever `ConsentApp` lives in `api/src/` (likely `api/src/consent/consentApp.ts`), `admin-frontend/src/widgets/consentWidgets.ts` (NEW, re-export existing editors), `admin-frontend/src/index.tsx`, plus tests
  - Depends on: 1.4, 2.2, 3.10
  - Acceptance: Registering `ConsentApp` causes both consent admins to appear in `/admin/config`. Form-side widgets resolve via the registry without consumer changes.

- [ ] **Task 5.4**: `DocumentStorageApp.adminContribution()`
  - Description: Convert `DocumentStorageApp` from "parallel admin" to a proper plugin contribution: keep its `register()` (mounts the documents endpoints), but additionally return `customScreens: [{name: "documents", displayName: "Documents", icon: "folder"}]` and a frontend widget keyed `"documents"` rendering the existing `DocumentStorageBrowser`. Remove the consumer's hand-roll of the route in `example-frontend`.
  - Files: `admin-backend/src/documentStorageApp.ts`, `admin-frontend/src/widgets/DocumentsScreenWidget.tsx` (NEW, wraps existing `DocumentStorageBrowser`), tests
  - Depends on: 1.4, 2.3, 3.3
  - Acceptance: `new DocumentStorageApp(...)` registered → `/admin/documents` route works in the new screen router with no host wiring.

- [ ] **Task 5.5**: `AIAdminApp` plugin
  - Description: Wrap the existing `addAiRequestsExplorerRoutes` into a small `AIAdminApp` plugin in `ai/src/` that implements `adminContribution()` returning `customScreens: [{name: "ai-requests", displayName: "AI Requests"}]`. Frontend widget wraps the existing custom AIAdminScreen.
  - Files: `ai/src/aiAdminApp.ts` (NEW), `admin-frontend/src/widgets/AIRequestsScreenWidget.tsx` (NEW; uses existing aggregation endpoint), tests
  - Depends on: 1.4, 2.3
  - Acceptance: Consumer drops the bespoke `customScreens` prop on `AdminModelList`, and the AI screen still appears via `new AIAdminApp()` registration.

## Phase 6 — Examples and docs

- [ ] **Task 6.0 (NEW)**: Audit `example-frontend/app/admin/consent-forms/` and `consent-responses/` custom screens
  - Description: List every file under those directories. Identify behaviors the generic `AdminScreenRouter` + `AdminModelForm` doesn't subsume (e.g., custom signing UI in `ConsentResponseViewer`). For each, decide: (a) becomes a screen widget contributed by `ConsentApp` (preferred), (b) stays as a hand-rolled route in example-frontend with a documented exception, (c) is unnecessary and can be deleted. Write findings into `docs/explanation/admin-consent-migration.md`.
  - Files: `docs/explanation/admin-consent-migration.md` (NEW)
  - Depends on: 5.3
  - Acceptance: Doc enumerates each file with an explicit disposition.

- [ ] **Task 6.1 (revised)**: Migrate `example-backend` to the new shape — single atomic change
  - Description: In `example-backend/src/server.ts`, move `Todos` and `Users` admin config from `AdminApp.models` onto each model's `modelRouter({admin: {...}})` call (`example-backend/src/api/todos.ts`, `example-backend/src/api/users.ts`). Remove the manually-passed `featureFlagAdminConfig` / `ConsentForm` / `ConsentResponse` entries — those come from plugin contributions now. Leave one legacy entry in `AdminApp.models` to demonstrate back-compat. Add `home: {widgets: [...]}` to AdminApp showing several widget types. This MUST land as a single commit/PR — don't split because Tasks 5.1/5.3/5.4/5.5 changing one at a time breaks the example app between phases.
  - Files: `example-backend/src/server.ts`, `example-backend/src/api/todos.ts`, `example-backend/src/api/users.ts`
  - Depends on: 5.1, 5.3, 5.4, 5.5
  - Acceptance: `bun run backend:dev` boots. `GET /admin/config` returns the same models as before. Legacy entry logs exactly one deprecation warning. CI does not have a window where example-backend is broken between phases.

- [ ] **Task 6.2**: Migrate `example-frontend` admin layout
  - Description: Wrap `app/admin/_layout.tsx` in `<AdminProvider api={api} baseUrl="/admin" widgets={{home: {...BUILT_IN_HOME_WIDGETS, "feature-flags-overrides": FeatureFlagOverridesWidget, ...}, fields: {...BUILT_IN_FIELD_WIDGETS, ...}}}>`. Replace `app/admin/index.tsx` with `<AdminHome />`. Replace `app/admin/[model]/index.tsx`'s string-switch with `<AdminScreenRouter name={modelName as string} />`. Verify form/edit routes still work.
  - Files: `example-frontend/app/admin/_layout.tsx`, `example-frontend/app/admin/index.tsx`, `example-frontend/app/admin/[model]/index.tsx`
  - Depends on: 3.12, 5.2, 5.4
  - Acceptance: `bun run frontend:web` runs. Admin home renders configured widgets. Navigating to `/admin/users`, `/admin/feature-flags`, `/admin/documents`, `/admin/ai-requests` all work via the screen router.

- [ ] **Task 6.3**: How-to doc — Add an admin to your model
  - Description: Cookbook walking through adding `admin: {...}` to a `modelRouter` call, listing the most-used fields with one-line each, then showing the final `/admin/users` UI. Link from the admin-backend README.
  - Files: `docs/how-to/admin-add-model.md`
  - Depends on: 6.1
  - Acceptance: Doc walks a reader through adding admin to a new model in under 5 minutes.

- [ ] **Task 6.4**: How-to doc — Custom field widget
  - Description: Cookbook for building a custom field widget: declare the widget name in `fieldOverrides`, write the component implementing the `AdminWidgetComponent` interface, register it in the provider. Use a `RichTextEditor` example.
  - Files: `docs/how-to/admin-custom-widget.md`
  - Depends on: 6.2
  - Acceptance: Doc shows a working example.

- [ ] **Task 6.5**: How-to doc — Customize the admin home page
  - Description: Walk through `home.widgets` with each built-in widget type, plugin-contributed widgets, and an ad-hoc component.
  - Files: `docs/how-to/admin-custom-home.md`
  - Depends on: 6.2
  - Acceptance: Doc demonstrates every widget type.

- [ ] **Task 6.6**: How-to doc — Import pre-built admins
  - Description: Show how to register `ConsentApp`, `FeatureFlagsApp`, `DocumentStorageApp`, `AIAdminApp` and surface their admins. Each section is ~5 lines of code.
  - Files: `docs/how-to/admin-import-prebuilt.md`
  - Depends on: 6.1
  - Acceptance: Doc covers all four plugins.

- [ ] **Task 6.7**: Reference doc — `AdminConfig`
  - Description: Full table of `AdminConfig` fields with Django equivalents in a sidebar column. One-line description per field. Include a small "migration from legacy shape" section.
  - Files: `docs/reference/admin-config.md`
  - Depends on: 1.1
  - Acceptance: Reference covers every field on `AdminConfig`, `AdminFilter`, `AdminFieldset`, `AdminAction`, `AdminContribution`.

## Phase 7 — Deprecations & polish

- [ ] **Task 7.1**: Update `.claude/rules/admin-backend/00-admin-backend.md` and `admin-frontend/00-admin-frontend.md`
  - Description: Reflect the new API in the per-package rule files so future Claude sessions and the MCP server get the updated patterns.
  - Files: `.claude/rules/admin-backend/00-admin-backend.md`, `.claude/rules/admin-frontend/00-admin-frontend.md`
  - Depends on: all
  - Acceptance: Rule files show `admin:` on modelRouter, `AdminProvider`, `AdminScreenRouter`, widget registry, and the legacy shape as deprecated.

- [ ] **Task 7.2**: MCP server updates
  - Description: Update `@terreno/mcp-server` `generate_route` tool to emit the new `admin:` config shape by default. Add a new prompt or tool: `generate_admin_widget` that scaffolds a custom widget.
  - Files: `mcp-server/src/tools.ts`, `mcp-server/src/prompts.ts`
  - Depends on: 6.7
  - Acceptance: `generate_route` output includes an `admin: {...}` block.

- [ ] **Task 7.3**: CHANGELOG + version bump
  - Description: Add a "Admin overhaul (Django-admin parity)" section to the changelogs of `@terreno/api`, `@terreno/admin-backend`, `@terreno/admin-frontend`, `@terreno/feature-flags`, `@terreno/ai`. Plan a minor version bump (e.g. 0.13.0 → 0.14.0). Note the deprecations and the codemod recipe.
  - Files: `api/CHANGELOG.md`, `admin-backend/CHANGELOG.md`, `admin-frontend/CHANGELOG.md`, `feature-flags/CHANGELOG.md`, `ai/CHANGELOG.md`, root `package.json` if catalog-versioned
  - Depends on: all
  - Acceptance: Changelogs read well; version bumps consistent across packages.

- [ ] **Task 7.4 (revised)**: End-to-end integration tests, split by feature
  - Description: Write Playwright specs in `example-frontend/e2e/`, one feature per file (per CLAUDE.local.md guidelines):
    - `admin-home.spec.ts` — login as admin, verify widgets render, click each widget link
    - `admin-table-search-filter.spec.ts` — search, filter drawer apply, combined filter+search, mobile sheet variant
    - `admin-table-bulk-actions.spec.ts` — multi-select, sync action, background action via run modal, confirmation modal
    - `admin-form.spec.ts` — fieldsets collapse/expand, readonly field disabled, autocomplete ref picker, validation error
    - `admin-custom-screens.spec.ts` — Documents browser navigation + upload, AI Requests explorer
  - All testIDs already added in Phase 4 tasks (4.1-4.4) and Phase 5. `loginAs(page)` used in `beforeEach`.
  - Files: 5 new specs under `example-frontend/e2e/`
  - Depends on: 6.2
  - Acceptance: All five specs pass locally; CI runs them in parallel.

- [ ] **Task 7.5**: Cross-package compile + lint pass
  - Description: Run `bun run compile && bun run lint` across the monorepo, fix anything that breaks from the new types or renamed exports. Re-run `bun run test`.
  - Files: monorepo
  - Depends on: all
  - Acceptance: Green CI.

- [ ] **Task 7.6 (NEW)**: Migration helper script for downstream consumers
  - Description: Write a short sed-based migration recipe in `docs/how-to/admin-migrate.md`. Idempotent. Walks a consuming repo through: (1) bumping `@terreno/*` versions, (2) detecting `AdminApp({models: [...]})` and either keeping (legacy ok) or migrating to `admin:` on modelRouter, (3) replacing `<AdminModelList .../>` with `<AdminProvider><AdminHome/></AdminProvider>`, (4) replacing the consumer's `[model]/index.tsx` string-switch with `<AdminScreenRouter name={...}/>`. Include before/after diffs. Test the recipe by running it against `example-frontend` and verifying it produces the same result as Task 6.2.
  - Files: `docs/how-to/admin-migrate.md`, `scripts/admin-migrate.sh` (optional)
  - Depends on: 6.2
  - Acceptance: Doc walks a reader through the migration in under 15 minutes; sed recipe (if shipped) is idempotent.

- [ ] **Task 7.7 (NEW)**: Telemetry and observability
  - Description: Add structured log lines (via `logger.info` with stable shape) for: (1) `/admin/config` response time + size, (2) action invocation: `{actionName, modelName, idCount, userId, durationMs, outcome: "ok"|"error"|"forbidden"|"rejected"}`, (3) filter parse errors: `{modelName, filterName, error}`, (4) deprecation warnings (legacy shape, legacy export, legacy customScreens prop): emit each once-per-process. No new dashboards; downstream consumers can scrape from logs.
  - Files: `admin-backend/src/adminApp.ts`, `admin-backend/src/actionRunner.ts`, `admin-backend/src/filterParser.ts`, `admin-backend/src/legacy.ts`
  - Depends on: 2.4, 2.6, 2.8
  - Acceptance: A `grep "level":"info","event":"admin.action"` over the log stream during the E2E run shows entries for every action invocation with the documented fields.
