# Implementation Plan: Upgrade Banner

*When an engineer is assigned to a project but before you begin coding, you should fill in the implementation plan and get feedback from the engineering team. Once you have finished or you make any changes, tag Josh with the @ symbol so he can review. Also tag anyone else that needs to be notified, has conflicting work, etc.*

## Models

### VersionConfig (new, singleton)

```typescript
// api/src/models/versionConfig.ts

const versionConfigSchema = new mongoose.Schema<VersionConfigDocument>(
  {
    webWarningVersion: {
      type: Number,
      default: 0,
      description: "Build number at which web users see a warning toast",
    },
    webRequiredVersion: {
      type: Number,
      default: 0,
      description: "Build number at which web users are blocked from using the app",
    },
    mobileWarningVersion: {
      type: Number,
      default: 0,
      description: "Build number at which mobile users see a warning toast",
    },
    mobileRequiredVersion: {
      type: Number,
      default: 0,
      description: "Build number at which mobile users are blocked from using the app",
    },
    warningMessage: {
      type: String,
      default: "A new version is available. Please update for the best experience.",
      description: "Message shown in the warning toast",
    },
    requiredMessage: {
      type: String,
      default: "This version is no longer supported. Please update to continue.",
      description: "Message shown on the blocking screen",
    },
    updateUrl: {
      type: String,
      description: "App store or download URL for mobile updates (optional, falls back to expo-updates)",
    },
  },
  { strict: "throw", toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

versionConfigSchema.plugin(addDefaultPlugins);
```

**Key design points:**
- Singleton — only one document in the collection
- All version fields default to `0` (meaning "no constraint"), so the check returns "ok" until an admin configures thresholds
- Per-platform version thresholds (web vs mobile), shared messages
- `updateUrl` is optional — mobile falls back to expo-updates OTA

## APIs

### 1. Version Check (public, built-in)

| | |
|---|---|
| Method | `GET /version-check` |
| Auth | None (public) |
| Query Params | `version` (integer build number), `platform` ("web" \| "mobile") |
| Response | `{status: "ok" \| "warning" \| "required", message?: string, updateUrl?: string}` |
| Notes | Built into `setupServer`/`TerrenoApp` automatically. Returns `{status: "ok"}` if no VersionConfig document exists. |

**Logic:**
```
if platform version < requiredVersion → status: "required", message: requiredMessage, updateUrl
else if platform version < warningVersion → status: "warning", message: warningMessage, updateUrl
else → status: "ok"
```

### 2. Admin: Get Version Config

| | |
|---|---|
| Method | `GET /admin/version-config` |
| Auth | `Permissions.IsAdmin` |
| Response | The singleton VersionConfig document (or defaults if none exists) |

### 3. Admin: Update Version Config

| | |
|---|---|
| Method | `PUT /admin/version-config` |
| Auth | `Permissions.IsAdmin` |
| Body | All VersionConfig fields |
| Response | Updated VersionConfig document |
| Notes | Upsert — creates if doesn't exist, updates if it does. |

Custom routes (not modelRouter) since it's a singleton — no list, no delete, no `:id` params.

## Notifications

No notifications required for this feature. The upgrade system is passive — it checks on app mount and shows in-app UI only.

## UI

### Component 1: `UpgradeRequiredScreen` (new, `@terreno/ui`)

- Full-screen page with centered content
- Warning icon, the `requiredMessage` text, and an "Update" button
- Update button behavior controlled by `onUpdate` callback prop:
  - **Web:** calls `window.location.reload()`
  - **Mobile:** attempts `expo-updates` OTA → falls back to opening `updateUrl` via `Linking`
- No back button, no navigation, no dismiss — user is stuck here
- Props: `message: string`, `onUpdate: () => void`

### Component 2: `useUpgradeCheck` hook (new, `@terreno/rtk`)

- Called in consuming app's root layout
- On mount: `GET /version-check?version={buildNumber}&platform={web|mobile}`
- If `"warning"`: shows persistent toast with message + "Update" action button
- If `"required"`: returns a flag for the consuming app to render `UpgradeRequiredScreen`
- Returns: `{isRequired: boolean, requiredMessage?: string, onUpdate: () => void}`
- Skips check if build number is missing/unknown (dev environment)
- `onUpdate` handles platform logic: web refresh, mobile expo-updates or Linking to updateUrl

### Component 3: Admin Version Config Screen (new, `@terreno/admin-frontend`)

- Form with fields: webWarningVersion, webRequiredVersion, mobileWarningVersion, mobileRequiredVersion, warningMessage, requiredMessage, updateUrl
- Single "Save" button that PUTs the singleton
- Accessible from the admin model list as a special entry

### Navigation Flow

```
App mounts → useUpgradeCheck() fires
  → "ok"       → normal app
  → "warning"  → normal app + persistent toast with "Update" button + dismiss X
  → "required" → UpgradeRequiredScreen (blocks everything)
```

## Phases

### Phase 1: Backend + Admin

- VersionConfig Mongoose model in `@terreno/api`
- `GET /version-check` public endpoint built into TerrenoApp
- `GET/PUT /admin/version-config` admin routes
- Admin frontend screen for version config
- Unit tests for the version check logic
- Example backend wired up

**Deliverable:** Admin can configure version thresholds and the public endpoint responds correctly.

### Phase 2: Client + CI

- `UpgradeRequiredScreen` component in `@terreno/ui`
- `useUpgradeCheck` hook in `@terreno/rtk`
- `app.config.js` helper for build number injection via `expo.extra.buildNumber`
- Example frontend wired up with the hook
- GitHub Actions snippet for `git rev-list --count HEAD`

**Deliverable:** Client apps can check version on mount and show warning toast or blocking screen.

## Feature Flags & Migrations

- **No feature flag needed.** The system is inert by default — the endpoint returns `"ok"` until an admin creates a VersionConfig document with non-zero thresholds.
- **No data migration needed.** New model, new collection, starts empty.
- **Rollout:** Ship it. Apps that don't call `useUpgradeCheck()` are unaffected.

## Activity Log & User Updates

No activity logging needed for this feature. Version config changes are admin-only and low-frequency.

## Not Included / Future Work

- Per-user or per-role version targeting
- Gradual rollout / percentage-based enforcement
- Push notifications for version updates
- Automatic semver bumping (stays manual via git tags)
- Periodic polling (only checks on mount for now)
- Per-app configs for multi-frontend backends
- Version check middleware on every API response
- Analytics on how many users are on which versions
