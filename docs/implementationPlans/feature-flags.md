# Implementation Plan: Feature Flags

*When an engineer is assigned to a project but before you begin coding, you should fill in the implementation plan and get feedback from the engineering team. Once you have finished or you make any changes, tag Josh with the @ symbol so he can review. Also tag anyone else that needs to be notified, has conflicting work, etc.*

## Problem

There is no way to toggle features at runtime — enabling or disabling functionality requires a code change and deploy. Developers can't safely roll out new features to specific users, and there's no mechanism to gate debug tooling (e.g., verbose websocket logging) per-user without redeploying.

## Business Case

Feature flags enable safer rollouts, per-user debugging, and runtime configuration without deploys. Integrating directly into the admin panel makes flag management accessible to non-engineers and removes the need for a third-party service like LaunchDarkly for simple use cases.

## Solution

A LaunchDarkly-inspired feature flag system built into `@terreno/admin-backend` and `@terreno/admin-frontend`. Flags are **declared in code** (version-controlled, tied to PRs) and **managed in admin** (toggled, overridden per-user). Supports boolean and string flag types.

Key capabilities:
- **Code-declared flags** with transactional startup sync (safe for multi-node deploys)
- **Evaluation API** on `AdminApp`: `variation()`, `boolVariation()`, `stringVariation()`, `allFlags()`
- **Per-user overrides** via Mongoose plugin on User schema
- **Flagged logger** utility for gating debug logs behind flags
- **Admin UI** with full flag management: global toggle, per-user overrides, audit log
- **Frontend endpoint** (`GET /admin/flags/me`) returning resolved flag values for the current user

## Scope

**In scope:** Flag model, user plugin, startup sync, evaluation API, flagged logger, 7 API endpoints, admin list/detail screens, example app integration.

**Out of scope:** Percentage rollouts, targeting rules, flag prerequisites, multi-kind contexts, real-time updates, analytics/experimentation, flag scheduling, environment-specific values.

---

## Models

### FeatureFlag

New Mongoose model in `@terreno/admin-backend`. Stores flag definitions synced from code and global state. Change tracking is handled via audit logs, not embedded history.

```typescript
const featureFlagSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: "Unique flag identifier used in code (e.g., 'new-checkout-flow')",
  },
  description: {
    type: String,
    default: "",
    description: "Human-readable description of what this flag controls",
  },
  flagType: {
    type: String,
    enum: ["boolean", "string"],
    required: true,
    description: "The value type of this flag",
  },
  defaultValue: {
    type: Schema.Types.Mixed,
    required: true,
    description: "Default value when the flag is enabled but no override is set",
  },
  enabled: {
    type: Boolean,
    default: false,
    description: "Global kill switch — when false, flag always returns code-provided default",
  },
  globalValue: {
    type: Schema.Types.Mixed,
    description: "Optional global override value when flag is enabled",
  },
  status: {
    type: String,
    enum: ["active", "archived"],
    default: "active",
    description: "Active flags are registered in code; archived flags have been removed from code",
  },
}, {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}});

featureFlagSchema.plugin(createdUpdatedPlugin);
```

### User Plugin (`featureFlagsPlugin`)

Mongoose plugin exported from `@terreno/admin-backend` that adds a `featureFlags` field to any User schema.

```typescript
export const featureFlagsPlugin = (schema: Schema) => {
  schema.add({
    featureFlags: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
      description: "Per-user feature flag overrides (key → value)",
    },
  });
};
```

Applied by the consuming app:

```typescript
userSchema.plugin(featureFlagsPlugin);
```

## APIs

Flag management routes are mounted by `AdminApp` automatically when flags are configured. Admin endpoints require `IsAdmin`, the `/flags/me` endpoint requires `IsAuthenticated`.

### Flag Management (mounted by AdminApp)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/admin/flags` | List all flags (filterable by `status`) | IsAdmin |
| GET | `/admin/flags/:key` | Get a single flag by key | IsAdmin |
| PATCH | `/admin/flags/:key` | Update flag (`enabled`, `globalValue`) | IsAdmin |
| GET | `/admin/flags/:key/users` | List users with overrides for this flag | IsAdmin |
| PUT | `/admin/flags/:key/users/:userId` | Set a user's override for this flag | IsAdmin |
| DELETE | `/admin/flags/:key/users/:userId` | Remove a user's override for this flag | IsAdmin |

### User-Facing Endpoint

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/admin/flags/me` | Get all evaluated flag values for the current user | IsAuthenticated |

Returns a simple `Record<string, boolean | string>` — just keys and resolved values. No flag metadata, no admin details. This is what frontends consume to gate UI features.

**Notes:**
- No POST (create) or DELETE (delete) — flags are code-declared only.
- PATCH and user override endpoints write audit log entries (who changed what, previous/new values).
- User override endpoints update `user.featureFlags` Map.
- GET `/admin/flags` supports `?status=active` and `?status=archived` query params.
- GET `/admin/flags/:key/users` returns a list of users who have overrides set, with their override values.

### Internal Evaluation API (not HTTP — used in code)

```typescript
// Generic evaluation
adminApp.variation(key: string, user: UserDocument | null, defaultValue: any): Promise<any>

// Typed evaluation
adminApp.boolVariation(key: string, user: UserDocument | null, defaultValue: boolean): Promise<boolean>
adminApp.stringVariation(key: string, user: UserDocument | null, defaultValue: string): Promise<string>

// Bulk evaluation
adminApp.allFlags(user: UserDocument | null): Promise<Record<string, any>>
```

**Evaluation order:**
1. Check `user.featureFlags.get(key)` — if set, return it
2. Check flag doc: if `enabled` and `globalValue` is set, return `globalValue`
3. Check flag doc: if `enabled`, return `defaultValue` from flag doc
4. Flag not enabled or not found — return the code-provided default

## Notifications

No notifications required for this feature. Flag changes are tracked via audit logs.

## UI

### Admin Frontend Screens (in `@terreno/admin-frontend`)

#### 1. Flag List Screen (`FlagList`)
- DataTable showing all flags: key, description, type, enabled (toggle), status badge
- Filter by status (active / archived)
- Click row to navigate to flag detail
- Uses `DataTable` from `@terreno/ui`

#### 2. Flag Detail Screen (`FlagDetail`)
- **Metadata section** (read-only): key, description, type, defaultValue
- **Global controls**: enabled toggle, globalValue input (boolean toggle or text field based on flagType)
- **User Overrides section**:
  - Table of users with overrides: name/email, override value, remove button
  - "Add Override" button → user search + value input
- **Audit Log section**:
  - Chronological list of changes pulled from audit logs: who, when, what field, old → new value
  - Shows targetUserId for per-user changes

### Navigation
- Admin nav gets a "Feature Flags" entry automatically
- `FlagList` → `FlagDetail` via row click

### Reusable Components
- From `@terreno/ui`: DataTable, Button, TextField, SelectField, Badge, Card, Page, Box, Text
- Existing `@terreno/admin-frontend` patterns: `useAdminApi`, `AdminFieldRenderer`, etc.

## Phases

### Phase 1: Backend + Core Evaluation

Everything needed for flags to work in code, manageable via API.

- FeatureFlag model added to `@terreno/admin-backend`
- `featureFlagsPlugin` for User schema exported from `@terreno/admin-backend`
- Flag registration and transactional startup sync added to `AdminApp`
- Evaluation API (`variation`, `boolVariation`, `stringVariation`, `allFlags`) on `AdminApp`
- `createFlaggedLogger` utility exported from `@terreno/admin-backend`
- Flag admin API endpoints mounted by `AdminApp`
- Tests for model, sync, evaluation, and routes
- Example backend integration

**Deliverable:** Flags can be declared in code, synced on startup, evaluated in route handlers, and managed via admin API calls.

### Phase 2: Admin Frontend

UI for managing flags without API calls.

- FlagList and FlagDetail screens added to `@terreno/admin-frontend`
- `useFlagsApi` hook in `@terreno/admin-frontend`
- Navigation integration (automatic "Feature Flags" entry)
- Example frontend integration

**Deliverable:** Admins can view, toggle, and manage flags per-user through the admin UI.

## Feature Flags & Migrations

No feature flag needed for the feature flag system — it's automatically available when using `AdminApp`. Apps opt in to per-user overrides by applying `featureFlagsPlugin` to their User schema. Flag registration is optional — if no flags are configured, the feature is inert.

No data migrations. Existing users get an empty `featureFlags` Map on first access.

## Activity Log & User Updates

Flag changes (toggle, global value, user overrides) are written to audit logs with: who changed it, what field, previous value, new value, and target user (for per-user overrides). No user-facing updates.

## Not Included / Future Work

- Percentage rollouts / gradual rollouts
- Targeting rules (match user attributes like plan, role, etc.)
- Flag prerequisites (flag A depends on flag B being on)
- Multi-kind contexts (only User — no org, device, etc.)
- Real-time flag updates via websocket/SSE (evaluate on each request)
- `track()` analytics or experimentation metrics
- Flag scheduling (turn on/off at a specific time)
- Flag environments (different values for dev/staging/prod)
- Bulk user override operations (CSV import, etc.)

---

## Task List (Bot Consumption)

*Structured task breakdown for automated implementation. Each task should be independently implementable and testable.*

### Phase 1: Backend + Core Evaluation

- [ ] **Task 1.1**: Add FeatureFlag model to `admin-backend`
  - Description: Create the FeatureFlag Mongoose model with schema, types, indexes, and `createdUpdatedPlugin` as specified in the Models section. Export from `@terreno/admin-backend`.
  - Files: `admin-backend/src/models/featureFlag.ts`, `admin-backend/src/index.ts`
  - Depends on: none
  - Acceptance: Model can be imported from `@terreno/admin-backend`, schema matches spec, unique index on `key`

- [ ] **Task 1.2**: Add `featureFlagsPlugin` to `admin-backend`
  - Description: Implement the Mongoose plugin that adds `featureFlags: Map<string, Mixed>` to a schema. Export from `@terreno/admin-backend`.
  - Files: `admin-backend/src/plugins/featureFlagsPlugin.ts`, `admin-backend/src/index.ts`
  - Depends on: none
  - Acceptance: Plugin can be applied to a schema, adds the `featureFlags` field

- [ ] **Task 1.3**: Add flag registration and startup sync to `AdminApp`
  - Description: Extend `AdminApp` constructor to accept an optional `flags` array of `{key, type, defaultValue, description}`. On `register()`, perform transactional sync: bulkWrite upserts for registered flags, updateMany to archive unregistered flags. Use `mongoose.startSession()` with `withTransaction()`. If no flags are configured, skip sync entirely.
  - Files: `admin-backend/src/adminApp.ts`
  - Depends on: Task 1.1
  - Acceptance: Flags sync to DB on startup, concurrent starts don't create duplicates, removed flags get archived, existing `enabled`/`globalValue` are preserved, no-op when no flags configured

- [ ] **Task 1.4**: Add evaluation API to `AdminApp`
  - Description: Add `variation()`, `boolVariation()`, `stringVariation()`, and `allFlags()` methods to `AdminApp`. Follow evaluation order: user override → global value → flag default → code default. Anonymous (null user) gets global default only.
  - Files: `admin-backend/src/adminApp.ts`
  - Depends on: Task 1.3
  - Acceptance: All four methods work correctly, evaluation order is correct, never throws (always returns a value)

- [ ] **Task 1.5**: Add `createFlaggedLogger` to `admin-backend`
  - Description: Add `createFlaggedLogger(flagKey, namespace)` to `AdminApp` that returns a logger object with `debug(user, message, meta?)`, `info(user, message, meta?)`, `warn(user, message, meta?)`, `error(user, message, meta?)` methods. Each method checks the flag for the given user before logging via Winston logger.
  - Files: `admin-backend/src/flaggedLogger.ts`, `admin-backend/src/index.ts`
  - Depends on: Task 1.4
  - Acceptance: Logger no-ops when flag is off, logs with namespace prefix when flag is on

- [ ] **Task 1.6**: Add flag admin API endpoints to `AdminApp`
  - Description: Add the 7 endpoints to `AdminApp.register()`: GET `/admin/flags/me` (IsAuthenticated, returns evaluated flags for current user), plus 6 admin endpoints — list flags, get flag, update flag, list user overrides, set user override, remove user override (all IsAdmin). Mount under the admin basePath. PATCH and override endpoints write audit log entries. User override endpoints update `user.featureFlags` Map.
  - Files: `admin-backend/src/adminApp.ts` or `admin-backend/src/routes/flags.ts`
  - Depends on: Task 1.4, Task 1.2
  - Acceptance: `/admin/flags/me` returns resolved flag values for authenticated user, all 6 admin endpoints work, audit logs are written, user.featureFlags is updated on override changes

- [ ] **Task 1.7**: Write tests for feature flags
  - Description: Write tests covering: model creation/validation, startup sync (including concurrent/idempotent behavior), evaluation order, flagged logger, admin endpoints (CRUD, audit logging, user overrides). Use bun test with MongoDB memory server.
  - Files: `admin-backend/src/tests/featureFlags.test.ts`
  - Depends on: Task 1.6
  - Acceptance: All tests pass, cover happy paths and edge cases

- [ ] **Task 1.8**: Integrate with example-backend
  - Description: Apply `featureFlagsPlugin` to example User model. Add flags config to `AdminApp` with a few sample flags (e.g., `new-feature`, `ws-debug`). Add a flagged logger example.
  - Files: `example-backend/src/models/user.ts`, `example-backend/src/server.ts`
  - Depends on: Task 1.6
  - Acceptance: Example backend starts, flags sync, evaluation works, admin flag endpoints accessible

### Phase 2: Admin Frontend

- [ ] **Task 2.1**: Add `useFlagsApi` hook to `admin-frontend`
  - Description: RTK Query hook (similar to `useAdminApi`) that injects endpoints for the 7 flag routes. Returns typed hooks: `useListFlagsQuery`, `useGetFlagQuery`, `useUpdateFlagMutation`, `useListFlagUsersQuery`, `useSetUserOverrideMutation`, `useRemoveUserOverrideMutation`, `useMyFlagsQuery`.
  - Files: `admin-frontend/src/useFlagsApi.tsx`, `admin-frontend/src/index.tsx`
  - Depends on: none
  - Acceptance: Hooks connect to backend endpoints, types are correct

- [ ] **Task 2.2**: Build FlagList screen in `admin-frontend`
  - Description: DataTable screen listing all flags. Columns: key, description, flagType, enabled (toggle), status (badge). Filter by active/archived. Row click navigates to detail. Uses `@terreno/ui` components.
  - Files: `admin-frontend/src/FlagList.tsx`, `admin-frontend/src/index.tsx`
  - Depends on: Task 2.1
  - Acceptance: Lists flags, filter works, inline toggle updates flag, navigation works

- [ ] **Task 2.3**: Build FlagDetail screen in `admin-frontend`
  - Description: Detail screen with: read-only metadata (key, description, type, defaultValue), global toggle + value input, user overrides table with add/remove, audit log section. Uses `useFlagsApi` hooks for all mutations.
  - Files: `admin-frontend/src/FlagDetail.tsx`, `admin-frontend/src/index.tsx`
  - Depends on: Task 2.1
  - Acceptance: All sections render, mutations work, audit log displays correctly

- [ ] **Task 2.4**: Integrate with example-frontend
  - Description: Add flag screens to example-frontend admin section. Add navigation entry for "Feature Flags".
  - Files: `example-frontend/app/admin/flags/` screens
  - Depends on: Task 2.2, Task 2.3
  - Acceptance: Flag management accessible from admin UI in example app, full workflow works end-to-end
