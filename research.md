# Research: Terreno Upgrade Banner System

## Summary

The Terreno codebase already sends `App-Version` and `App-Platform` headers with every API request via RTK's base query. Building an upgrade banner system requires: (1) a backend model + built-in endpoint for version config, (2) admin screens to manage it, (3) a client hook + prebuilt UI, and (4) CI automation for commit-count-based versioning. The existing `AdminApp` plugin pattern, `Banner` component, toast system, and `Page` component provide strong foundations to build on.

## Context

- **Problem:** No mechanism to notify users their app is outdated. Stale clients can hit deprecated APIs or miss critical fixes.
- **Current state:** RTK already sends `App-Version` (from `Constants.expoConfig?.version`) and `App-Platform` ("web"/"mobile") on every request (`rtk/src/emptyApi.ts:164-177`). But nothing consumes these headers or enforces version constraints.
- **Goal:** Two-tier system — soft warning (dismissible toast/banner) and hard block (full-screen, no dismiss). Admin-configurable. Auto-versioned via CI.

## Decisions

- **Per-platform config:** Yes — separate thresholds for web vs mobile since web can force-refresh but mobile needs app store update.
- **Update mechanism:** Platform-specific — web forces page refresh, mobile triggers expo-updates OTA if available, falls back to app store link.
- **Endpoint location:** Built-in route in `setupServer`/`TerrenoApp` — no reason not to have this as a framework feature.
- **Config storage:** Mongoose model (database-backed) so admins can change without redeploy.

## Findings

### Finding 1: Existing Version Infrastructure in RTK

`rtk/src/emptyApi.ts:164-177` — Every API request already includes:
```typescript
const version = Constants.expoConfig?.version ?? "Unknown";
headers.set("App-Version", version);
headers.set("App-Platform", IsWeb ? "web" : "mobile");
```

The version comes from `expo-constants` → `app.json`'s `version` field. Currently `example-frontend/app.json` has `"version": "1.0.0"`.

### Finding 2: Admin Backend Plugin Pattern

`admin-backend/src/adminApp.ts` — The `AdminApp` class provides the pattern:
- Constructor takes config, `register(app)` adds routes to Express
- Uses `modelRouter` with `Permissions.IsAdmin` for all CRUD
- Exposes a `/admin/config` metadata endpoint

### Finding 3: Admin Frontend Patterns

`admin-frontend/` uses a data-driven approach:
- `useAdminConfig(api, baseUrl)` fetches model metadata
- `useAdminApi(api, routePath, modelName)` generates CRUD hooks dynamically
- All screens accept `baseUrl` and `api` props
- For upgrade config, we need a custom admin screen (singleton config, not a collection)

### Finding 4: UI Components Available

**Banner** (`ui/src/Banner.tsx`) — status variants, persistent dismiss, action button
**Toast** (`ui/src/Toast.tsx`) — `useToast()` with warn/info/error variants, persistent mode
**Page** (`ui/src/Page.tsx`) — Full-screen layout for the blocking screen
**Modal** (`ui/src/Modal.tsx`) — Dialog, but Page is better for hard block (zero escape)

### Finding 5: GitHub Actions & Versioning

Current flow: manual git tag → `publish-on-tag.yml` → selective npm publish.
No existing build number system. `app.json` version is static.
`git rev-list --count HEAD` provides simple, monotonically increasing build numbers.

### Finding 6: RTK Store Integration

`example-frontend/store/index.ts` — store combines auth, appState, API reducers.
`_layout.tsx` checks auth state and routes conditionally — upgrade check follows same pattern.

## Recommendation

**Add to core packages** — spread across:
- `@terreno/api` — VersionConfig model + public `GET /version-check` endpoint (built-in)
- `@terreno/admin-frontend` — Custom admin screen for version config
- `@terreno/rtk` — `useUpgradeCheck` hook
- `@terreno/ui` — `UpgradeRequiredScreen` blocking component

**Versioning:** `git rev-list --count HEAD` as integer build number. Helper in CI to set `expo.version` at build time.

**API:** `GET /version-check?version=123&platform=web` — public, no auth. Returns `{status: "ok" | "warning" | "required", message?, url?}`.

## References

- `rtk/src/emptyApi.ts:164-177` — Existing App-Version header
- `admin-backend/src/adminApp.ts` — Plugin registration pattern
- `admin-frontend/src/useAdminApi.tsx` — Dynamic RTK hook generation
- `ui/src/Banner.tsx` — Banner component
- `ui/src/Toast.tsx` — Toast notification system
- `ui/src/Page.tsx` — Full-screen page layout
- `example-frontend/app/_layout.tsx` — Root layout with auth routing
- `.github/workflows/publish-on-tag.yml` — Current CI/CD versioning
