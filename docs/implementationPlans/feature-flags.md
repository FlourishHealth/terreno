# Implementation Plan: Feature Flags

*When an engineer is assigned to a project but before you begin coding, you should fill in the implementation plan and get feedback from the engineering team. Once you have finished or you make any changes, tag Josh with the @ symbol so he can review. Also tag anyone else that needs to be notified, has conflicting work, etc.*

## Models

### FeatureFlag

New Mongoose model in `@terreno/flags-backend`. Stores flag definitions synced from code, global state, and audit history.

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
  history: [{
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      description: "Admin user who made the change",
    },
    changedAt: {
      type: Date,
      default: Date.now,
      description: "When the change was made",
    },
    field: {
      type: String,
      description: "Which field was changed (enabled, globalValue, userOverride)",
    },
    previousValue: {
      type: Schema.Types.Mixed,
      description: "Value before the change",
    },
    newValue: {
      type: Schema.Types.Mixed,
      description: "Value after the change",
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      description: "If this was a per-user override change, which user it applies to",
    },
  }],
}, {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}});

featureFlagSchema.plugin(createdUpdatedPlugin);
```

### User Plugin (`featureFlagsPlugin`)

Mongoose plugin that adds a `featureFlags` field to any User schema.

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

All endpoints are admin-only. Regular users never interact with flags directly — evaluation happens in server code.

### Flag Management (mounted by FlagsApp)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/flags` | List all flags (filterable by `status`) | IsAdmin |
| GET | `/flags/:key` | Get a single flag by key | IsAdmin |
| PATCH | `/flags/:key` | Update flag (`enabled`, `globalValue`) | IsAdmin |
| GET | `/flags/:key/users` | List users with overrides for this flag | IsAdmin |
| PUT | `/flags/:key/users/:userId` | Set a user's override for this flag | IsAdmin |
| DELETE | `/flags/:key/users/:userId` | Remove a user's override for this flag | IsAdmin |

**Notes:**
- No POST (create) or DELETE (delete) — flags are code-declared only.
- PATCH records history entries with `changedBy`, previous/new values.
- User override endpoints update `user.featureFlags` Map AND record history on the flag doc.
- GET `/flags` supports `?status=active` and `?status=archived` query params.
- GET `/flags/:key/users` returns a list of users who have overrides set, with their override values.

### Internal Evaluation API (not HTTP — used in code)

```typescript
// Generic evaluation
flagsApp.variation(key: string, user: UserDocument | null, defaultValue: any): Promise<any>

// Typed evaluation
flagsApp.boolVariation(key: string, user: UserDocument | null, defaultValue: boolean): Promise<boolean>
flagsApp.stringVariation(key: string, user: UserDocument | null, defaultValue: string): Promise<string>

// Bulk evaluation
flagsApp.allFlags(user: UserDocument | null): Promise<Record<string, any>>
```

**Evaluation order:**
1. Check `user.featureFlags.get(key)` — if set, return it
2. Check flag doc: if `enabled` and `globalValue` is set, return `globalValue`
3. Check flag doc: if `enabled`, return `defaultValue` from flag doc
4. Flag not enabled or not found — return the code-provided default

## Notifications

No notifications required for this feature. Flag changes are tracked via audit history on the FeatureFlag model, visible in the admin UI.

## UI

### Admin Frontend Screens

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
- **History section**:
  - Chronological list of changes: who, when, what field, old → new value
  - Shows targetUserId for per-user changes

### Navigation
- Admin nav gets a "Feature Flags" entry
- `FlagList` → `FlagDetail` via row click

### Reusable Components
- From `@terreno/ui`: DataTable, Button, TextField, SelectField, Badge, Card, Page, Box, Text
- From `@terreno/admin-frontend`: layout patterns, `useAdminApi`-style hooks

## Phases

### Phase 1: Backend + Core Evaluation

Everything needed for flags to work in code, manageable via API.

- `@terreno/flags-backend` package: FeatureFlag model, FlagsApp (TerrenoPlugin), startup sync (transactional), evaluation API, flagged logger, admin API endpoints
- `featureFlagsPlugin` for User schema
- Tests for model, sync, evaluation, and routes
- Example backend integration

**Deliverable:** Flags can be declared in code, synced on startup, evaluated in route handlers, and managed via admin API calls.

### Phase 2: Admin Frontend

UI for managing flags without API calls.

- `@terreno/flags-frontend` package: FlagList screen, FlagDetail screen (toggle, global value, user overrides, history)
- Navigation integration with admin-frontend patterns
- Example frontend integration

**Deliverable:** Admins can view, toggle, and manage flags per-user through the admin UI.

## Feature Flags & Migrations

No feature flag needed for the feature flag system — it's additive. Apps opt in by:
1. Adding `featureFlagsPlugin` to their User schema
2. Registering `FlagsApp` with `TerrenoApp`

No data migrations. Existing users get an empty `featureFlags` Map on first access.

## Activity Log & User Updates

No activity logging beyond the built-in `history` array on the FeatureFlag model. This is admin-only tooling with no user-facing updates.

## Not Included / Future Work

- Percentage rollouts / gradual rollouts
- Targeting rules (match user attributes like plan, role, etc.)
- Flag prerequisites (flag A depends on flag B being on)
- Multi-kind contexts (only User — no org, device, etc.)
- Real-time flag updates via websocket/SSE (evaluate on each request)
- `track()` analytics or experimentation metrics
- Client-side SDK or frontend evaluation helper
- Flag scheduling (turn on/off at a specific time)
- Flag environments (different values for dev/staging/prod)
- Bulk user override operations (CSV import, etc.)
- History pagination or cap (monitor growth, add later if needed)

---

## Task List (Bot Consumption)

*Structured task breakdown for automated implementation. Each task should be independently implementable and testable.*

### Phase 1: Backend + Core Evaluation

- [ ] **Task 1.1**: Scaffold `flags-backend` package
  - Description: Create `flags-backend/` directory with `package.json`, `tsconfig.json`, `src/index.ts`. Add to root workspace. Follow the same structure as `admin-backend/`.
  - Files: `flags-backend/package.json`, `flags-backend/tsconfig.json`, `flags-backend/src/index.ts`, root `package.json` (workspace entry)
  - Depends on: none
  - Acceptance: `bun install` succeeds, package compiles with `bun run compile`

- [ ] **Task 1.2**: Create FeatureFlag model
  - Description: Implement the FeatureFlag Mongoose model with schema, types, indexes, and plugins as specified in the Models section. Include `createdUpdatedPlugin`. Export from package index.
  - Files: `flags-backend/src/models/featureFlag.ts`, `flags-backend/src/index.ts`
  - Depends on: Task 1.1
  - Acceptance: Model can be imported, schema matches spec, unique index on `key`

- [ ] **Task 1.3**: Create `featureFlagsPlugin`
  - Description: Implement the Mongoose plugin that adds `featureFlags: Map<string, Mixed>` to a schema. Export from package index.
  - Files: `flags-backend/src/plugins/featureFlagsPlugin.ts`, `flags-backend/src/index.ts`
  - Depends on: Task 1.1
  - Acceptance: Plugin can be applied to a schema, adds the `featureFlags` field

- [ ] **Task 1.4**: Implement flag registration and startup sync
  - Description: Build the `FlagsApp` class implementing `TerrenoPlugin`. Constructor accepts an array of flag definitions `{key, type, defaultValue, description}`. On `register()`, perform transactional sync: bulkWrite upserts for registered flags, updateMany to archive unregistered flags. Use `mongoose.startSession()` with `withTransaction()`.
  - Files: `flags-backend/src/flagsApp.ts`, `flags-backend/src/index.ts`
  - Depends on: Task 1.2
  - Acceptance: Flags sync to DB on startup, concurrent starts don't create duplicates, removed flags get archived, existing `enabled`/`globalValue` are preserved

- [ ] **Task 1.5**: Implement evaluation API
  - Description: Add `variation()`, `boolVariation()`, `stringVariation()`, and `allFlags()` methods to `FlagsApp`. Follow evaluation order: user override → global value → flag default → code default. Anonymous (null user) gets global default only.
  - Files: `flags-backend/src/flagsApp.ts`
  - Depends on: Task 1.4
  - Acceptance: All four methods work correctly, evaluation order is correct, never throws (always returns a value)

- [ ] **Task 1.6**: Implement `createFlaggedLogger`
  - Description: Add `createFlaggedLogger(flagKey, namespace)` to `FlagsApp` that returns a logger object with `debug(user, message, meta?)`, `info(user, message, meta?)`, `warn(user, message, meta?)`, `error(user, message, meta?)` methods. Each method checks the flag for the given user before logging via Winston logger.
  - Files: `flags-backend/src/flaggedLogger.ts`, `flags-backend/src/index.ts`
  - Depends on: Task 1.5
  - Acceptance: Logger no-ops when flag is off, logs with namespace prefix when flag is on

- [ ] **Task 1.7**: Implement admin API endpoints
  - Description: Add the 6 admin endpoints to `FlagsApp.register()`: list flags, get flag, update flag, list user overrides, set user override, remove user override. All require `IsAdmin`. PATCH and override endpoints record history entries. User override endpoints update `user.featureFlags` Map.
  - Files: `flags-backend/src/flagsApp.ts` or `flags-backend/src/routes/flags.ts`
  - Depends on: Task 1.4, Task 1.3
  - Acceptance: All 6 endpoints work, history is recorded, user.featureFlags is updated on override changes

- [ ] **Task 1.8**: Write tests for flags-backend
  - Description: Write tests covering: model creation/validation, startup sync (including concurrent/idempotent behavior), evaluation order, flagged logger, admin endpoints (CRUD, history, user overrides). Use bun test with MongoDB memory server.
  - Files: `flags-backend/src/tests/`, `flags-backend/src/tests/bunSetup.ts`
  - Depends on: Task 1.7
  - Acceptance: All tests pass, cover happy paths and edge cases

- [ ] **Task 1.9**: Integrate with example-backend
  - Description: Apply `featureFlagsPlugin` to example User model. Register `FlagsApp` with example `TerrenoApp` with a few sample flags (e.g., `new-feature`, `ws-debug`). Add a flagged logger example.
  - Files: `example-backend/src/models/user.ts`, `example-backend/src/server.ts`, `example-backend/package.json`
  - Depends on: Task 1.7
  - Acceptance: Example backend starts, flags sync, evaluation works, admin endpoints accessible

### Phase 2: Admin Frontend

- [ ] **Task 2.1**: Scaffold `flags-frontend` package
  - Description: Create `flags-frontend/` directory with `package.json`, `tsconfig.json`, `src/index.tsx`. Add to root workspace. Follow `admin-frontend/` structure.
  - Files: `flags-frontend/package.json`, `flags-frontend/tsconfig.json`, `flags-frontend/src/index.tsx`, root `package.json`
  - Depends on: none
  - Acceptance: Package compiles

- [ ] **Task 2.2**: Create `useFlagsApi` hook
  - Description: RTK Query hook (similar to `useAdminApi`) that injects endpoints for the 6 flag admin routes. Returns typed hooks: `useListFlagsQuery`, `useGetFlagQuery`, `useUpdateFlagMutation`, `useListFlagUsersQuery`, `useSetUserOverrideMutation`, `useRemoveUserOverrideMutation`.
  - Files: `flags-frontend/src/useFlagsApi.tsx`
  - Depends on: Task 2.1
  - Acceptance: Hooks connect to backend endpoints, types are correct

- [ ] **Task 2.3**: Build FlagList screen
  - Description: DataTable screen listing all flags. Columns: key, description, flagType, enabled (toggle), status (badge). Filter by active/archived. Row click navigates to detail. Uses `@terreno/ui` components.
  - Files: `flags-frontend/src/FlagList.tsx`
  - Depends on: Task 2.2
  - Acceptance: Lists flags, filter works, inline toggle updates flag, navigation works

- [ ] **Task 2.4**: Build FlagDetail screen
  - Description: Detail screen with: read-only metadata (key, description, type, defaultValue), global toggle + value input, user overrides table with add/remove, history list. Uses `useFlagsApi` hooks for all mutations.
  - Files: `flags-frontend/src/FlagDetail.tsx`
  - Depends on: Task 2.2
  - Acceptance: All sections render, mutations work, history displays correctly

- [ ] **Task 2.5**: Export and integrate with example-frontend
  - Description: Export `FlagList` and `FlagDetail` from package. Add flag screens to example-frontend admin section. Add navigation entry.
  - Files: `flags-frontend/src/index.tsx`, `example-frontend/app/admin/flags/` screens, `example-frontend/package.json`
  - Depends on: Task 2.3, Task 2.4
  - Acceptance: Flag management accessible from admin UI in example app, full workflow works end-to-end
