# Implementation Plan: Admin Interface Overhaul (Django-Admin Parity)

## Goal

Bring Terreno's admin from "rendered CRUD" to "Django-admin-class developer experience": admin config co-located on `modelRouter`, pre-built admins composable via the existing `TerrenoPlugin` contract, a richer table (search, filter sidebar, bulk actions, fieldsets, readonlyFields), a declarative customizable home page, a widget registry consumers can extend, and an API surface that's forward-compatible with realtime via Socket.io.

## Non-goals (v1)

- Shipping a Socket.io server (the API surface is realtime-ready; the transport ships in a follow-up).
- True related-model inlines (Django `TabularInline`/`StackedInline`). Subdoc inlines via `AdminNestedArrayField` continue to work.
- `date_hierarchy`, `prepopulated_fields`, `list_editable`, `show_facets`. Roadmapped for v1.1+.
- Replacing the existing AdminApp config (`AdminApp.models`) — kept with deprecation warning for one minor cycle.

## Decisions from adversarial review

Verified findings folded back in. The five most consequential:

1. **TerrenoPlugin signature is extended (not changed).** `register(app, openApi?, terrenoApp?)` — third argument optional, ignored by existing plugins. `TerrenoApp.build()` passes itself as the third arg. This is how `AdminApp` discovers registered routers and plugin contributions, and how `modelRouter` reaches the app to emit events. No new global registry.
2. **No renames of existing fields.** `listFields`, `defaultSort`, `fieldOverrides`, `fieldOrder`, `hiddenFields` stay as-is. Only *new* options are added (`searchFields`, `sortableFields`, `filters`, `fieldsets`, `readonlyFields`, `excludeFields`, `autocompleteFields`, `actions`, `adminPermissions`, `adminFilter`, `realtime`, `listDisplayLinks`, `pageSize`, `group`, `icon`). The "Alias + warning" migration applies only to the *shape* (passing `AdminModelConfig` to `AdminApp.models` vs. setting `admin:` on the modelRouter).
3. **Event payloads are scrubbed at emit time.** `admin:model.changed` events are emitted *after* `excludeFields`/`hiddenFields` filtering (not from raw `postCreate`/etc. hooks). The emit step runs `removeHiddenFields` against the merged exclude+hidden set so future socket listeners cannot leak secrets.
4. **`adminFilter` is async from day one.** Signature: `(req: AuthedRequest) => Promise<FilterQuery<T>> | FilterQuery<T>`. Matches the existing async `queryFilter` contract.
5. **Action runs use a frozen context, not the live `req`.** Background actions especially: at enqueue time we snapshot `{ userId, userSnapshot, ids, actionName, requestId, startedAt }` into an `AdminActionContext` and pass *that* to `action.run`. Mirrors the existing `ScriptContext` pattern (admin-backend/src/adminApp.ts:622-638).

Also folded (lower severity, see Risks/Files-to-Touch/Tasks for specifics):

- Widget registry locked to `{ fields, home, screens }` three-bucket shape *before* Phase 3 begins. Field-widgets and home-widgets and screen-widgets are semantically different and use the same lookup mechanism.
- Collision precedence reversed: **registered modelRouter > plugin contribution > legacy `AdminApp.models`**. Most-specific source wins, "legacy" is purely additive. Duplicate `routePath` from two registered modelRouters → throw at build time.
- Filter parser is per-type strict: each `AdminFilter.type` accepts exactly one value shape; anything else → 400. Test matrix in Task 2.6 covers array-injection, operator-injection (`$ne`, `$gt`, `$where`, `$regex`), prototype-pollution, and shape mismatches.
- `readonlyFields` enforced on all body-accepting routes including modelRouter's array sub-routes (`POST /:id/:field`, `PATCH /:id/:field/:itemId`, `DELETE /:id/:field/:itemId`). Implementation point: wrap `preUpdate` AND `preCreate` once; enforcement runs unconditionally regardless of route.
- `excludeFields` / `hiddenFields` recursion through `populatePaths`: each populated document is scrubbed with *its* model's admin config. If the referenced model has no admin config, populated docs are returned as-is (consumer's choice not to admin-register that model).
- Bulk actions capped at `MAX_ACTION_IDS = 1000` per request. Bulk validation uses one `find({_id: {$in: ids}, ...adminFilter})` round-trip — no N+1.
- Per-action permission booleans in `/admin/config`: class-level evaluation calls `checkPermissions(action, ..., user, undefined)` and treats any throw as `false`. `IsOwner` returns `false` (no object) — that's correct: admins can't generally "own" all rows pre-fetch.
- Soft-deleted documents: out of scope for this IP. `AdminConfig.includeDeleted?: boolean` added to the type for v1.1; no implementation now (documented in non-goals).
- `ConfigurationApp` and the existing `VersionConfig` singleton routes: stay where they are. Singleton models get a separate IP. `VersionConfig` continues to be served by `AdminApp` directly (until then) but no longer appears in the synthetic `customScreens` array — it's surfaced via a built-in `versionConfig` home widget.
- CSRF + rate-limit: `/actions/:name` inherits whatever auth+rate-limit middleware the app has installed. Documented; no new middleware in this IP. Better Auth cookie sessions are a known risk (out-of-scope until rate-limit IP).

## High-level architecture

```
@terreno/api
  modelRouter(...) { ...options, admin?: AdminConfig }     ← new option
  TerrenoApp.getRegistrations()                            ← new accessor
  TerrenoPlugin.adminContribution?(): AdminContribution    ← new optional method
  AdminEventBus (typed emit/on, no transport)              ← new (lays realtime groundwork)

@terreno/admin-backend
  AdminApp                                                  ← rewritten to aggregate:
    1. admin configs on registered model routers
    2. plugin adminContribution() results
    3. legacy AdminApp({models:[]}) input (deprecated, accepted)
  Server-side enforcement:
    - readonlyFields stripped from PATCH bodies
    - excludeFields removed from forms AND responses
    - filters/search/ordering parsed from query params
    - actions executed (sync or background via BackgroundTask)

@terreno/admin-frontend
  <AdminProvider api baseUrl widgets={...}>                ← new top-level context
  <AdminScreenRouter>                                       ← new data-driven dispatcher (replaces consumer's switch)
  <AdminHome>                                               ← rewrite of AdminModelList; widget-driven
  AdminModelTable (extended)                                ← search box, filter drawer, bulk-select, actions
  AdminModelForm  (extended)                                ← fieldsets, readonlyFields, autocomplete refs
  AdminFieldRenderer                                        ← widget map from context
  widgets/                                                  ← built-in widgets (ModelStats, RecentActivity, ScriptRunner)
```

## Configuration shapes (canonical)

### `AdminConfig` (on modelRouter)

**Naming note:** existing fields (`listFields`, `defaultSort`, `fieldOverrides`, `fieldOrder`, `hiddenFields`) keep their names. The "alias + warning" migration applies to the *shape* (passing `AdminModelConfig` to `AdminApp.models` vs. setting `admin:` on the modelRouter), not to renaming individual fields.

```typescript
export interface AdminConfig<T = unknown> {
  /** Human-readable name for the model in the admin (e.g., "Users"). */
  displayName: string;

  /** Optional sidebar group label. Models without a group go in "Other". */
  group?: string;

  /** Optional icon (FontAwesome 6 name) for navigation. */
  icon?: string;

  // ── List view ───────────────────────────────────────────────────
  listFields: string[];                         // columns shown in the table (existing name kept)
  listDisplayLinks?: string[];                  // NEW. columns that click-through to edit (default: [first])
  searchFields?: string[];                      // NEW. strings → regex search; surfaces search box in UI
  sortableFields?: string[];                    // NEW. allowlist; default = all in listFields
  defaultSort?: string | string[];              // existing name kept
  pageSize?: number;                            // NEW. default rows per page (default: 25)

  filters?: AdminFilter[];                      // NEW. sidebar filters (see below)

  // ── Form view ───────────────────────────────────────────────────
  fieldsets?: AdminFieldset[];                  // NEW. grouped form layout; mutually exclusive with fieldOrder
  fieldOrder?: string[];                        // existing
  readonlyFields?: string[];                    // NEW. display-only; enforced server-side
  excludeFields?: string[];                     // NEW. stronger than hiddenFields — not in forms OR detail responses
  hiddenFields?: string[];                      // existing (not in list/form; still in raw detail unless also excluded)
  autocompleteFields?: string[];                // NEW. ref fields → async search (uses /search)
  fieldOverrides?: Record<string, AdminFieldOverride>;  // existing

  // ── Permissions & scoping ───────────────────────────────────────
  adminPermissions?: Partial<{                  // NEW. per-action override (default: IsAdmin for all)
    list: Permission[];
    read: Permission[];
    create: Permission[];
    update: Permission[];
    delete: Permission[];
  }>;
  /** NEW. Row-level scoping for admins. Async to allow fetching scope info (e.g., user.organizationId → org members). */
  adminFilter?: (req: AuthedRequest) => Promise<mongoose.FilterQuery<T>> | mongoose.FilterQuery<T>;

  // ── Bulk actions ────────────────────────────────────────────────
  actions?: AdminAction<T>[];                   // NEW

  // ── Realtime (API surface only in this IP) ──────────────────────
  realtime?: boolean;                            // NEW. when true, scrubbed emit fires after each mutation

  // ── Forward-compat placeholder (v1.1) ───────────────────────────
  includeDeleted?: boolean;                     // NEW (type only; behavior in v1.1)
}

export interface AdminFilter {
  field: string;                                 // schema field name (must be in queryFields)
  type: "boolean" | "choice" | "date" | "dateRange" | "ref" | "text";
  label?: string;                                // display label (default: humanized field name)
  choices?: { value: string; label: string }[]; // for "choice"; auto-derived from schema enum if absent
  refModel?: string;                             // for "ref"; auto-derived from schema ref if absent
}

export interface AdminFieldset {
  title: string;
  fields: string[];
  collapsed?: boolean;
  description?: string;
}

export interface AdminFieldOverride {
  widget?: string;                               // widget key (resolved against the frontend widget registry)
  label?: string;
  helpText?: string;
}

export interface AdminAction<T = unknown> {
  name: string;                                  // url-safe id
  label: string;                                 // shown in dropdown
  description?: string;
  confirm?: string;                              // confirmation prompt text
  permissions?: Permission[];                    // defaults to model's adminPermissions.update
  background?: boolean;                          // route through BackgroundTask + AdminScriptRunModal
  run: (ctx: AdminActionContext<T>) =>
    Promise<{ updatedIds?: string[]; message?: string; results?: string[] }>;
}

/**
 * Frozen, request-independent context handed to `action.run`. For sync actions, captured immediately
 * before invocation. For `background: true` actions, captured at enqueue time and persisted on the
 * BackgroundTask — `req` may be torn down by the time the background runner picks it up.
 *
 * Mirrors the `ScriptContext` pattern in admin-backend/src/adminApp.ts:622-638.
 */
export interface AdminActionContext<T = unknown> {
  /** Snapshot of `req.user._id` at enqueue. */
  userId: string;
  /** Snapshot of `req.user` (lean, no methods). May be stale for long-running background actions. */
  user: Pick<UserDocument, "_id" | "email" | "admin" | "name">;
  /** Validated ids that exist AND pass the model's `adminFilter`. Capped at `MAX_ACTION_IDS`. */
  ids: string[];
  /** Echoed back from URL. */
  actionName: string;
  /** Stable id for log correlation. */
  requestId: string;
  /** ISO timestamp captured at enqueue. */
  startedAt: string;
  /** Model the action is acting on (avoids importing model registry from inside run). */
  model: Model<T>;
  /** Logger pre-tagged with {actionName, requestId, userId}. */
  logger: Logger;
}

/** Server-side cap on `ids[]` accepted in a single action invocation. Documented; enforced; configurable per-app. */
export const MAX_ACTION_IDS = 1000;
```

### `AdminContribution` (on plugins)

```typescript
export interface AdminContribution {
  /** Model admins this plugin provides. Equivalent to registering a modelRouter with admin set. */
  models?: AdminModelContribution[];

  /** Standalone screens for things like DocumentStorageBrowser. */
  customScreens?: AdminCustomScreen[];

  /** Optional contributions to the home page. Host must list the id in home.widgets to surface it. */
  homeWidgets?: AdminHomeWidgetContribution[];

  /** Server-side admin scripts (one-off jobs). */
  scripts?: AdminScriptConfig[];
}

export interface AdminModelContribution<T = unknown> {
  model: Model<T>;
  routePath: string;
  admin: AdminConfig<T>;
  permissions?: RESTPermissions<T>;              // public-API permissions if the plugin owns the router
}

export interface AdminCustomScreen {
  name: string;                                  // url-safe id, used in URL (/admin/{name})
  displayName: string;
  icon?: string;
  group?: string;
}

export interface AdminHomeWidgetContribution {
  id: string;                                    // referenced by host from home.widgets
  displayName: string;
  icon?: string;
  /** Optional list of model names whose changes the widget cares about (used by the future realtime layer). */
  watches?: string[];
}

export interface TerrenoPlugin {
  /**
   * Existing signature is preserved with one BACKWARD-COMPATIBLE extension: a third optional `terrenoApp`
   * argument carrying the parent `TerrenoApp`. Plugins that ignore it work unchanged.
   *
   * `TerrenoApp.build()` always passes `(app, oapi, this)` from terrenoApp.ts:321.
   */
  register(app: express.Application, openApi?: unknown, terrenoApp?: TerrenoApp): void;

  /** NEW (optional). Called by `AdminApp` during its own `register()` to collect contributions. */
  adminContribution?(): AdminContribution;
}
```

**Why this signature, not constructor injection or a `terreno.useAdmin(...)` method:** keeps plugin construction order (`new AdminApp({...})`) free of references to `TerrenoApp`, mirrors how `openApi` is already passed, and is a backward-compatible additive change. All existing plugins (`HealthApp`, `BetterAuthApp`, `ConfigurationApp`, `FeatureFlagsApp`, `LangfuseApp`, `DocumentStorageApp`, `ConsentApp`) compile unchanged.

**modelRouter discovery side:** `ModelRouterRegistration._buildWithOpenApi(openApi)` (api/src/api.ts:449) becomes `_buildWithContext({openApi, terrenoApp})`. `TerrenoApp.build()` passes itself in at registration time. The built router closes over the TerrenoApp reference so its lifecycle hooks can call `terrenoApp.emit("admin:model.changed", ...)`. The existing function signature is renamed; this is internal API. No public consumer should be calling `_buildWithOpenApi` directly.

### `AdminApp` options (host-side)

```typescript
new AdminApp({
  basePath?: "/admin";                            // existing
  models?: AdminModelContribution[];              // existing; accepts the legacy shape too (with warning)
  scripts?: AdminScriptConfig[];                  // existing
  home?: AdminHomeConfig;                         // NEW
});

export interface AdminHomeConfig {
  title?: string;
  widgets?: (AdminHomeWidgetSpec | string)[];     // strings resolve to plugin-contributed widgets by id
  layout?: "grid" | "list";
}

export type AdminHomeWidgetSpec =
  | { type: "modelStats"; models?: string[] }            // counts for selected models
  | { type: "recentActivity"; limit?: number; models?: string[] }
  | { type: "scriptRunner" }
  | { type: "customScreensList" }
  | { type: "modelsGrid"; group?: string }               // legacy auto-grid (default if no home given)
  | string                                                 // plugin-contributed widget id
  | React.ComponentType;                                   // ad-hoc inline component
```

## `/admin/config` response (extended)

```typescript
interface AdminConfigResponse {
  models: AdminModelMeta[];               // existing, with fields below added
  scripts: AdminScriptMeta[];             // existing
  customScreens: AdminCustomScreen[];     // existing, plugin contributions merged in
  home?: AdminHomeMeta;                   // NEW
  widgetIds: string[];                    // NEW: plugin-contributed widget ids the frontend should look up
  capabilities: {                         // NEW: simple feature flags so older frontends fail soft
    actions: boolean;
    filters: boolean;
    fieldsets: boolean;
    realtime: boolean;
  };
}

interface AdminModelMeta {
  name: string;
  routePath: string;
  displayName: string;
  group?: string;
  icon?: string;

  listFields: string[];                   // existing name kept; canonical
  listDisplayLinks: string[];             // defaults to [first of listFields]
  searchFields: string[];                 // empty array if search not configured
  sortableFields: string[];               // defaults to listFields
  defaultSort: string;                    // existing name kept
  pageSize: number;                       // default 25

  filters: AdminFilterMeta[];

  fieldsets?: AdminFieldset[];            // if absent, frontend falls back to fieldOrder
  fieldOrder?: string[];                  // existing
  readonlyFields: string[];
  excludeFields: string[];
  hiddenFields: string[];                 // existing; emitted alongside excludeFields for clarity
  autocompleteFields: string[];
  fields: Record<string, AdminFieldMeta>; // existing
  fieldOverrides: Record<string, AdminFieldOverride>;  // emitted so the frontend can resolve widgets

  actions: AdminActionMeta[];             // {name, label, confirm, background, allowed: boolean}
  permissions: {                          // booleans for the current user (computed server-side per request)
    list: boolean; read: boolean; create: boolean; update: boolean; delete: boolean;
  };
  realtime: boolean;
}
```

### Widget registry shape (locked here so Phase 3/4/5 don't reinvent it)

```typescript
export interface AdminWidgetRegistry {
  /** Field widgets resolve `fieldOverrides[fieldName].widget` to a form-field component. */
  fields: Record<string, FieldWidgetComponent>;
  /** Home widgets resolve `home.widgets` string ids (and plugin-contributed widget ids) to a dashboard component. */
  home: Record<string, HomeWidgetComponent>;
  /** Screen widgets resolve `customScreens[].name` to a full-page screen component. Used by AdminScreenRouter. */
  screens: Record<string, ScreenWidgetComponent>;
}
```

Three separate buckets because (a) the lookup happens in three different places, (b) the component props differ (field widgets receive `value`/`onChange`; home widgets receive `config`; screen widgets receive route params), and (c) lets each bucket evolve its prop contract independently. Same string id can exist in two buckets without conflict.

### Realtime emit step (no leakage)

```typescript
// inside modelRouter postCreate/postUpdate/postDelete, guarded by options.admin?.realtime === true:
const safeDoc = scrubAdminFields(savedDoc, options.admin); // strips excludeFields + hiddenFields
terrenoApp.emit("admin:model.changed", {
  type: "create" | "update" | "delete",
  modelName: model.modelName,
  routePath: registration.path,
  documentId: String(savedDoc._id),
  document: safeDoc, // already scrubbed
  user: { id: String(req.user._id) },
  at: new Date().toISOString(),
});
```

`scrubAdminFields` shares the implementation of `removeHiddenFields` (admin-backend/src/adminApp.ts:132). For delete events, `document` is omitted entirely.

The current-user permission booleans are computed **per-request** (`/admin/config` is gated by `IsAdmin`, but per-action permissions may further restrict). This lets the frontend hide "Create" buttons the user can't use.

## URL conventions

Concrete example (Users model with `routePath: "/users"` and an `activate` action):

```
GET  /admin/config
GET  /admin/users?page=2&pageSize=25&sort=-created&q=alice&filter[admin]=true&filter[role]=staff
GET  /admin/users/507f1f77bcf86cd799439011
POST /admin/users
PATCH /admin/users/507f1f77bcf86cd799439011
DELETE /admin/users/507f1f77bcf86cd799439011
GET  /admin/users/search?q=ali&fields=email,name              ← used by autocompleteFields ref pickers
POST /admin/users/actions/activate                            ← body: {ids: string[]} (≤ MAX_ACTION_IDS=1000)
POST /admin/scripts/syncConsents/run                          ← existing
GET  /admin/scripts/tasks/abc123                              ← existing (also used for background actions)
GET  /admin/widgets/feature-flags-overrides/data              ← OPTIONAL — plugin widgets may register a data endpoint
```

### Filter param parsing (strict per-type)

Express+`qs` parses `filter[k]=v`, `filter[k][gte]=v`, and `filter[k][]=v` into different shapes. The filter parser declares one accepted shape per `AdminFilter.type`; everything else returns HTTP 400 with `{title: "Invalid filter", fields: {<filterName>: "..."}}`:

| `type` | Accepted shape | Rejects |
|--------|----------------|---------|
| `boolean` | scalar `"true"` \| `"false"` | arrays, nested objects, anything else |
| `text` | scalar string | arrays, objects |
| `choice` | scalar string in declared choices | arrays, objects, unknown values |
| `ref` | scalar string that is a valid ObjectId | arrays, objects, non-ObjectId strings |
| `date` | scalar ISO date string | arrays, objects |
| `dateRange` | `{ gte?: ISO, lte?: ISO }` only — both keys optional but no others | arrays, scalars, extra keys |

Mongo operator keys (`$ne`, `$gt`, `$where`, `$regex`, `$in`, …) are NEVER passed through. Prototype-pollution attempts (`__proto__`, `constructor.prototype`, …) are dropped silently and logged at warn level. Only fields declared in `admin.filters[]` are honored at all.

## Server-side enforcement (security-critical)

| Concern | Enforcement |
|---------|-------------|
| `readonlyFields` | Stripped from POST + PATCH bodies AND from array sub-routes (`POST /:id/:field`, `PATCH /:id/:field/:itemId`, `DELETE /:id/:field/:itemId`). Single enforcement point: a body-scrubbing middleware installed on every body-accepting admin route, not just `preUpdate`. |
| `excludeFields` / `hiddenFields` | Stripped from POST + PATCH bodies and from list + detail responses. **Recursively applied through `populatePaths`**: when a populated doc is encountered, scrub it against *its* model's admin config (if any). Models with no admin config are returned as-is — consumer's responsibility not to populate sensitive refs without admin-registering them. |
| `adminPermissions` | Per-route guard. Class-level evaluation (no object): `checkPermissions(action, perms, user, undefined)`; any throw → `false`. `IsOwner` returns `false` at the class level (no object to own). Per-action endpoints additionally run `action.permissions`. |
| `adminFilter` | Async signature. Applied as a `$and` to the modelRouter's existing `queryFilter` for all list/read/update/delete on the admin namespace. |
| `filters` | Per-type strict shape (see "Filter param parsing"). Only fields in `admin.filters[]` honored. Mongo operator keys never pass through. Prototype-pollution attempts dropped. |
| `actions[].run` | Receives a frozen `AdminActionContext` (snapshot of user+ids+metadata at enqueue) — never the live `req`. Ids are validated via a single `find({_id: {$in: ids}, ...adminFilter})` round-trip; ids that don't pass `adminFilter` are silently excluded from the action's `ctx.ids`. |
| `MAX_ACTION_IDS` | `ids[]` capped at 1000 per request. Above → 413 Payload Too Large. Configurable per-app via `AdminApp.maxActionIds`. |
| `sortableFields` | Only allowlisted sort fields accepted. Unknown → 400. |
| Search | Regex over `searchFields` only; query string escaped (existing pattern). ObjectId fast-path for valid IDs. List endpoint's `?q=` and the `/search` endpoint share a single helper function — no two implementations of the same semantics. |
| Realtime emit | Emit happens *after* `removeHiddenFields`/`removeExcludeFields` scrub. Listeners (current AND future socket transport) never see hidden/excluded data. Delete events omit `document` entirely. |

## Realtime API surface (no transport in this IP)

Introduce a typed event bus on `TerrenoApp`:

```typescript
type AdminChangeEvent = {
  type: "create" | "update" | "delete";
  modelName: string;
  routePath: string;
  documentId: string;
  document?: unknown;            // omitted for delete
  user: { id: string };          // who made the change
  at: string;                    // ISO timestamp
};

class TerrenoApp {
  on(event: "admin:model.changed", listener: (e: AdminChangeEvent) => void): void;
  off(event: "admin:model.changed", listener: (e: AdminChangeEvent) => void): void;
  // (internal) emit("admin:model.changed", event)
}
```

`modelRouter` `postCreate`/`postUpdate`/`postDelete` hooks emit when `admin.realtime === true`. AdminApp registers a no-op listener that logs in debug mode. **No socket server is started.** The follow-up IP wires this to Socket.io. Frontend hooks accept an optional `socket` in `AdminProvider` and behave normally when absent.

## Files to Create / Modify

### `@terreno/api`

| File | Change |
|------|--------|
| `api/src/api.ts` | Add `admin?: AdminConfig` to `ModelRouterOptions`. Wrap lifecycle hooks to emit `admin:model.changed` when `admin.realtime` is true. |
| `api/src/terrenoApp.ts` | Add `getRegistrations()`, `getPlugins()`, `on/off/emit` typed event bus. |
| `api/src/terrenoPlugin.ts` | Add `adminContribution?(): AdminContribution` to the interface. |
| `api/src/adminTypes.ts` (NEW) | Export `AdminConfig`, `AdminFilter`, `AdminFieldset`, `AdminAction`, `AdminContribution`, `AdminChangeEvent`. (Live in `api` so plugins can import without depending on `admin-backend`.) |
| `api/src/index.ts` | Re-export the new types. |
| `api/src/api.test.ts` | Tests for emit-on-mutation gate, readonlyFields enforcement when admin config present. |

### `@terreno/admin-backend`

| File | Change |
|------|--------|
| `admin-backend/src/adminApp.ts` | Rewrite to aggregate from registered model routers, plugin contributions, and legacy `models[]`. Extend `/admin/config` response. Add filter/sort/search parsing. Add `/actions/:name` endpoint. Compute per-action permission booleans. |
| `admin-backend/src/legacy.ts` (NEW) | Adapt the legacy `AdminModelConfig` shape (`listFields`, etc.) to `AdminModelContribution`. Emit one-time deprecation warning per legacy entry. |
| `admin-backend/src/filterParser.ts` (NEW) | Convert `filter[k]=v` query params into a safe Mongoose filter using the model's declared `AdminFilter[]`. |
| `admin-backend/src/actionRunner.ts` (NEW) | Validate selected ids against `adminFilter`, run sync or background, return result. |
| `admin-backend/src/index.ts` | Export `AdminApp` + types. |
| `admin-backend/src/adminApp.test.ts` | Extend with tests for filter parsing, action invocation, plugin contribution aggregation, legacy shape acceptance. |

### `@terreno/admin-frontend`

| File | Change |
|------|--------|
| `admin-frontend/src/AdminProvider.tsx` (NEW) | React context: `{ api, baseUrl, widgets, socket?, theme? }`. Wraps the admin tree. |
| `admin-frontend/src/AdminScreenRouter.tsx` (NEW) | Data-driven dispatcher: reads `customScreens` from config, looks up component by name in registry, falls back to `AdminModelTable`. |
| `admin-frontend/src/AdminHome.tsx` (NEW; replaces AdminModelList semantically) | Renders `home.widgets` from config. Built-in widget components for `modelStats`, `recentActivity`, `scriptRunner`, `customScreensList`, `modelsGrid`. |
| `admin-frontend/src/AdminModelTable.tsx` | Add: search box (debounced, surfaces `?q=`), filter drawer (right-side, collapsible, mobile sheet), bulk-select column, actions dropdown, `sortableFields` enforcement, `pageSize` honored. |
| `admin-frontend/src/AdminModelForm.tsx` | Add: fieldsets (collapsible groups), `readonlyFields`, `autocompleteFields` → async ref picker, `excludeFields` honored. |
| `admin-frontend/src/AdminFieldRenderer.tsx` | Read widget map from `AdminProvider` context instead of hardcoded switch. |
| `admin-frontend/src/AdminFilterDrawer.tsx` (NEW) | Right-side drawer with one input per `AdminFilter`. Builds `filter[k]=v` query string. |
| `admin-frontend/src/AdminActionMenu.tsx` (NEW) | Dropdown next to bulk-select count. Confirms, sends POST to `/actions/:name`. For `background` actions, opens existing `AdminScriptRunModal`. |
| `admin-frontend/src/widgets/ModelStatsWidget.tsx` (NEW) | Renders counts via `useListQuery({page:1,pageSize:1})`. |
| `admin-frontend/src/widgets/RecentActivityWidget.tsx` (NEW) | Lists latest documents across selected models. |
| `admin-frontend/src/widgets/ScriptRunnerWidget.tsx` (NEW) | Compact script list (existing AdminScriptList trimmed). |
| `admin-frontend/src/widgets/ModelsGridWidget.tsx` (NEW) | The legacy "grid of every model" widget — the default home. |
| `admin-frontend/src/widgets/CustomScreensListWidget.tsx` (NEW) | Lists plugin-contributed custom screens. |
| `admin-frontend/src/types.ts` | Add: `AdminWidgetComponent`, `AdminWidgetRegistry`, `AdminContextValue`. Mirror the backend `AdminConfigResponse` shape. |
| `admin-frontend/src/AdminModelList.tsx` | Deprecate — keep as a thin wrapper that renders `<AdminHome widgets={[{type:"modelsGrid"}, {type:"scriptRunner"}, ...]}>` so existing consumers don't break. Mark for removal in v2. |
| `admin-frontend/src/index.tsx` | Export `AdminProvider`, `AdminHome`, `AdminScreenRouter`, widgets, types. |

### Pre-built admins (light contribution refactors)

| File | Change |
|------|--------|
| `feature-flags/src/featureFlagsApp.ts` | Implement `adminContribution()` returning the model admin + a `feature-flags-overrides` home widget. Delete bare `featureFlagAdminConfig` export (deprecate first). |
| `feature-flags/src/featureFlagAdminWidget.tsx` (NEW, in a frontend-shipping path) | The flag-overrides home widget component. |
| `api/src/consent/consentApp.ts` (wherever it lives) | Implement `adminContribution()` returning ConsentForm + ConsentResponse admins, plus `widgetComponents` for `locale-content`, `locale-default`, `checkbox-list`. |
| `admin-backend/src/documentStorageApp.ts` | Convert to a proper plugin contribution: `adminContribution()` returns `customScreens: [{name:"documents", displayName:"Documents", icon:"folder"}]`. Frontend component registered via the widget registry. |
| `ai/src/aiAdminApp.ts` (NEW or split out of routes) | Implement `adminContribution()` returning a custom screen for AI Requests Explorer. Consumer no longer needs to hand-roll it. |

### Example apps

| File | Change |
|------|--------|
| `example-backend/src/server.ts` | Demonstrate new pattern: pass `admin:` on each modelRouter, remove the verbose `AdminApp.models` repetition. Show declarative `home: { widgets }`. Leave one legacy `models[]` entry to demonstrate back-compat. |
| `example-backend/src/api/users.ts`, `api/todos.ts` | Add `admin:` config to each. |
| `example-frontend/app/admin/_layout.tsx` | Wrap in `<AdminProvider api={api} baseUrl="/admin" widgets={{...}}>`. |
| `example-frontend/app/admin/[model]/index.tsx` | Replace string-switch with `<AdminScreenRouter modelName={...}>`. |
| `example-frontend/app/admin/index.tsx` | Render `<AdminHome />` (was `<AdminModelList ...>`). |

### Documentation

| File | Change |
|------|--------|
| `docs/how-to/admin-add-model.md` (NEW) | "Add an admin for your model in three lines." |
| `docs/how-to/admin-custom-widget.md` (NEW) | "Build and register a custom field widget." |
| `docs/how-to/admin-custom-home.md` (NEW) | "Customize the admin home page." |
| `docs/how-to/admin-import-prebuilt.md` (NEW) | "Import the consent / feature-flags admins." |
| `docs/reference/admin-config.md` (NEW) | Full `AdminConfig` reference, mapped from Django equivalents. |
| `docs/implementationPlans/admin-improvements.md` | (this file) |

## Backward Compatibility & Migration

- `AdminApp({models: [{model, listFields, ...}]})` — accepted as-is for one minor release. Logged once-per-process as `[admin] AdminApp.models entry for "Users" uses the legacy shape (listFields/fieldOverrides). Migrate to modelRouter({...,admin:{listDisplay,...}}) — see docs/how-to/admin-add-model.md.`
- `listFields` accepted as an alias for `listDisplay` in the same window. Same one-time warning.
- `defaultSort` accepted as an alias for `ordering`.
- `hiddenFields` continues to mean "stripped from responses" (today's behavior). `excludeFields` is the new stronger version (stripped from forms AND responses). When both are set: union.
- `customScreens` array prop on `AdminModelList` becomes a no-op once the consumer switches to `AdminProvider` + `AdminScreenRouter`. We log a one-time warning if both are used.
- All existing endpoints (`GET /admin/config`, `GET /admin/{routePath}`, …) continue to work with the same payloads, plus additive fields. Old frontends see `capabilities.{actions,filters,fieldsets} === false` and skip the new UI affordances.

## Phases

### Phase 1 — Core API surface (`@terreno/api`)
Adds `AdminConfig`, plugin contribution interface, and the event bus. No UI changes; everything stays backward compatible.

### Phase 2 — Admin backend aggregation
Rewrites `AdminApp` to aggregate from registered routers and plugin contributions. Extends `/admin/config`. Adds filter parsing, action runner, server-side `readonlyFields`/`excludeFields` enforcement.

### Phase 3 — Admin frontend foundations
`AdminProvider`, `AdminScreenRouter`, widget registry, `AdminHome`, built-in widgets. No new table/form features yet — keep existing screens working through the new context.

### Phase 4 — Admin frontend feature lift
Search box, filter drawer, bulk-select + actions, fieldsets, `readonlyFields`, autocomplete refs. Each is a small PR.

### Phase 5 — Pre-built admin migrations
`feature-flags`, `consent`, `documentStorage`, `ai` all adopt `adminContribution()`. Each pre-built admin gets a one-line consumer story.

### Phase 6 — Examples and docs
`example-backend` and `example-frontend` rewritten to showcase. Four how-to docs and the reference.

### Phase 7 — Deprecations & polish
Warning messages, telemetry/log lines, codemod note in CHANGELOG.

## Risks

| Risk | Mitigation |
|------|-----------|
| Field-rename churn. | No renames. Only additive new options. Existing `listFields`, `defaultSort`, `fieldOverrides`, `fieldOrder`, `hiddenFields` keep their names. |
| Plugin discovery — `AdminApp` needs the parent `TerrenoApp`. | Extend `TerrenoPlugin.register(app, openApi?, terrenoApp?)` backward-compat additively. `TerrenoApp.build()` passes itself. Internal `_buildWithContext` on `ModelRouterRegistration` carries the same reference into modelRouter. |
| **routePath collisions.** Two registered modelRouters with the same `routePath` → fatal at build time (throw). | Plugin contribution and legacy `AdminApp.models` are additive: registered modelRouter wins over plugin wins over legacy. Loudest collision logs are the registered-vs-registered case. |
| Filter-injection. | Per-type strict shape (see "Filter param parsing"). Mongo operator keys never pass through. Declared-only fields honored. |
| Action runner footguns (deleting too many rows). | `confirm` text rendered server-side. `MAX_ACTION_IDS=1000`. Single `$in` validation; ids outside `adminFilter` scope silently excluded. Background actions get a frozen context, not the live `req`. |
| Realtime payload leakage. | Emit fires *after* `excludeFields`/`hiddenFields` scrub. Verified by test that asserts `hash` is absent from the emitted payload for a User-like model. |
| Widget registry typing. | Three buckets: `{ fields, home, screens }`. Each bucket has a typed component contract. Runtime fallback to a "missing widget" placeholder + one-time `console.warn` if a referenced key is absent. |
| `realtime: true` emits events with nowhere to go in v1. | Default `false`. Listener is no-op (debug-logged). Documented as forward-compat. |
| `AdminScreenRouter` rollout breaks consumers' existing string-switch. | Both paths supported during transition; warning emitted if consumer's `customScreens` prop and `AdminProvider` widgets are both set. |
| Per-user permission booleans in `/admin/config` make it uncacheable. | `Cache-Control: private, no-store` header. Endpoint already gated by `IsAdmin`. Test guards response size stays under 50KB for 30 models. |
| Background action runner uses stale `req.user`. | Captured snapshot only. Background task records `userId` separately; the snapshot is a hint, not authoritative. Re-resolve user via `userModel.findById(ctx.userId)` inside `action.run` if fresh data is needed. |
| `EventEmitter` default max listeners (10). | `TerrenoApp` constructor calls `setMaxListeners(50)` on its emitter. Documented. |
| Bundle size of widget registry. | Widgets are React components passed at provider construction time — consumers control which they import. Lazy-load via React.lazy is the consumer's choice (no built-in lazy support in v1). |
| Custom-screen pages in `example-frontend/app/admin/consent-forms/` etc. | Phase 6 explicitly audits these directories; behaviors that the generic `AdminScreenRouter` doesn't subsume become contributed screen widgets. |

## Acceptance Criteria (high level — full per-task in the task file)

1. A model with `admin: {...}` on its `modelRouter` appears in `/admin/config` with full metadata, without being passed to `AdminApp.models`.
2. Registering `new FeatureFlagsApp(...)` causes the `FeatureFlag` admin to appear automatically and `home.widgets: ["feature-flags-overrides"]` renders its widget.
3. Search box in the table debounces and surfaces hits using the existing `/search` endpoint scoped to `searchFields`.
4. Filter drawer renders one control per `AdminFilter`; combining filters narrows the list correctly server-side.
5. Bulk-select + actions: selecting rows and choosing an action POSTs `{ids}` to `/admin/{routePath}/actions/:name`. Sync actions return updated rows; `background: true` actions route through `AdminScriptRunModal` and show progress.
6. `readonlyFields` are visible in the form but disabled, and a manual PATCH that tries to change them is silently dropped server-side.
7. `fieldsets` render as collapsible groups in `AdminModelForm`.
8. `autocompleteFields` ref pickers async-search via `/search` instead of fetching the whole referenced collection.
9. The admin home page renders the configured widgets in the configured order. Plugin-contributed widgets only appear when listed.
10. The legacy `AdminApp({models: [{listFields: [...]}]})` shape continues to work and emits exactly one deprecation warning per legacy entry.
11. No socket server is started; no realtime events fire to clients. `admin.realtime: true` causes `TerrenoApp.emit("admin:model.changed", ...)` to fire (verified in unit test).
12. `example-backend` boots; `example-frontend` admin renders; all existing example admin flows still work.
13. All new types are exported from `@terreno/api`, `@terreno/admin-backend`, `@terreno/admin-frontend`.
14. Test coverage: filter parser, action runner, readonlyFields enforcement, plugin aggregation, legacy shape adapter, widget registry resolution, search debounce.

## Out of scope (explicit)

- Socket.io server / realtime UI updates.
- MongoDB change-stream emitter.
- True related-model inlines.
- `date_hierarchy`, `prepopulated_fields`, `list_editable`, `show_facets`.
- Theming / brand customization beyond `home.title`.
- Multi-AdminSite (Django allows several `AdminSite` instances).
