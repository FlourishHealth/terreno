# Implementation Plan: MMKV migration with AsyncStorage boot migration

**Status:** Open  
**Priority:** Medium  
**Effort:** Big batch (multiple packages, native-only engine + web parity path)

*When an engineer is assigned to a project but before you begin coding, you should fill in the implementation plan and get feedback from the engineering team. Once you have finished or you make any changes, tag Josh with the @ symbol so he can review. Also tag anyone else that needs to be notified, has conflicting work, etc.*

## Problem

`@react-native-async-storage/async-storage` is the default durable key-value layer for redux-persist and several UI utilities. On native, it is asynchronous and relatively slow for high-churn reads (rehydration, token checks, preference hooks). [react-native-mmkv](https://github.com/mrousavy/react-native-mmkv) provides a synchronous, mmap-backed store on iOS and Android, which improves startup latency and simplifies some call sites.

This plan migrates **eligible** persisted data from AsyncStorage to MMKV on native, introduces a **one-time boot migration** so existing installs keep their state, and keeps a **clear boundary** for what must *not* move to MMKV (web, SSR, and sensitive secrets policy).

## Goals

- Native (iOS/Android): use MMKV as the primary persisted store for redux-persist and shared app preferences where appropriate.
- **Boot migration**: on first launch after upgrade, copy known legacy keys from AsyncStorage into MMKV (or into the new persist layer), idempotently, then mark migration complete.
- Web: **continue using AsyncStorage** (current pattern) unless a separate browser storage decision is made; MMKV is not a drop-in for all web targets in this monorepo today.
- Preserve behavior for `@terreno/rtk` auth: **JWT access/refresh tokens on native already use `expo-secure-store`** (`authSlice.ts`, `emptyApi.ts`); **web uses AsyncStorage**. This migration must not silently weaken that split unless security signs off on an alternative (e.g. MMKV with encryption + threat model).

## Non-goals (initial release)

- Replacing Better Auth’s native `SecureStore` adapter with MMKV without a dedicated security review.
- Removing `@react-native-async-storage/async-storage` from the repo entirely while web and SSR-safe wrappers still depend on it.
- Changing redux-persist schema or public auth APIs without a semver major discussion.

## Current usage (inventory)

| Area | Role of AsyncStorage | Native token storage |
|------|----------------------|----------------------|
| `@terreno/rtk` `authSlice.ts` / `emptyApi.ts` | Web only for `AUTH_TOKEN` / `REFRESH_TOKEN` | `expo-secure-store` |
| `@terreno/rtk` `betterAuthClient.ts` | Web adapter | `expo-secure-store` on native |
| `example-frontend/store/index.ts` | `redux-persist` via `createSafeStorage()` | Same AsyncStorage-backed persist |
| `@terreno/ui` `useStoredState.ts`, `Unifier.ts`, `EmojiSelector.tsx` | Direct read/write | Same |
| MCP bootstrap templates / `admin-spa` | Web-oriented or generic | Follow consumer rules |

## Architecture

### Platform matrix

| Platform | Primary store after change | Migration source |
|----------|---------------------------|------------------|
| iOS / Android | MMKV instance(s) with documented ID / encryption option | AsyncStorage keys enumerated in registry |
| Web | AsyncStorage (unchanged) | N/A |

### Storage abstraction

Introduce a small internal (or public) **key-value interface** used by redux-persist adapters and UI helpers:

- `getItem(key): Promise<string | null>`
- `setItem(key, value): Promise<void>`
- `removeItem(key): Promise<void>`

Implementations:

- **`createWebAsyncStorage()`** — current behavior; guard `typeof window`.
- **`createNativeMmkvPersistStorage()`** — wraps MMKV for redux-persist (async façade over sync MMKV is acceptable; many codebases wrap sync MMKV in `Promise.resolve` for persist API compatibility).
- **`createNativePreferenceStorage()`** — optional second MMKV instance or shared instance with key prefix for `useStoredState` / Unifier / EmojiSelector.

Centralize **key constants** (persist root key, auth-related keys only on web, UI keys) in one module to avoid drift.

### Boot migration handler

**Purpose:** After upgrading, users must not lose redux state, cached UI preferences, or other persisted keys that move to MMKV.

**Idempotency:** Persist a sentinel in MMKV, e.g. `terreno.storageMigration.asyncStorageToMmkvV1` = `"completed"` (or numeric schema version). Until set, migration may re-run; individual key copies must be safe to repeat (overwrite MMKV with same value is fine).

**Ordering constraint:** Redux persist must not read an empty MMKV **before** migration copies `persist:root` (or equivalent) from AsyncStorage. Two supported patterns (pick one in implementation; both are valid):

1. **Explicit pre-bootstrap await (recommended for clarity):** Before `persistStore` runs, the app entry (`example-frontend` root layout or a tiny `storage/migrateOnBoot.native.ts` imported first) `await`s `runAsyncStorageToMmkvMigrationOnce()`. Only after resolution, import/create the store module **or** dispatch a custom “storage ready” event. This may require refactoring away from side-effectful store creation at top-level import order.
2. **Lazy migration inside storage `getItem` (first-touch):** The MMKV-backed `PersistStorage.getItem` checks the sentinel; if not migrated, performs async `AsyncStorage.multiGet` for registered keys, writes into MMKV, sets sentinel, then returns the requested key from MMKV. **Caveat:** first `getItem` must correctly chain async work; redux-persist supports async storage.

**Registry of keys:** Maintain a typed list of keys (and optional transforms) to migrate, for example:

- `persist:root` — redux-persist root blob used by `example-frontend` (`key: "root"` in `persistConfig`).
- Any `@terreno/ui` keys used by `Unifier`, `EmojiSelector`, `useStoredState` defaults used by shipped apps (enumerate from code grep; avoid migrating unknown third-party keys).

**Post-migration cleanup (optional, gated):** After successful copy + sentinel write, `multiRemove` the migrated keys from AsyncStorage to save space. **Risk:** rollback to an older app version would not see data — document as acceptable or gate cleanup behind a second sentinel / semver.

**Telemetry / logging:** Use `console.info`/`console.warn` on success/failure counts in dev; avoid logging values. On failure, leave AsyncStorage intact and fall back to reading AsyncStorage until next launch (define policy).

### redux-persist version bump

Increment `persistConfig.version` in consuming apps when changing storage backend or transform, and add a `migrate` function if the persisted JSON shape changes. Even if shape is unchanged, bumping version documents the storage move and allows `migrate` to no-op if needed.

### Dependencies and build

- Add `react-native-mmkv` to the **catalog** in root `package.json` and reference via `catalog:` in packages that bundle native code (`example-frontend`, `demo`, and optionally `@terreno/ui` if MMKV ships inside UI — **prefer** keeping MMKV in app layer and passing an injected storage interface into UI hooks later to avoid forcing native new arch on all UI consumers; if that is too large for v1, document “UI package still uses AsyncStorage until Phase 2”).
- Expo: follow MMKV maintainer docs for the repo’s Expo SDK / new architecture settings; add any required `app.json` plugins or config plugin steps to CI docs.

## Models

None (client-side persistence only).

## APIs

None (no REST surface). Optional **exported** helpers from `@terreno/rtk` or a tiny `@terreno/storage` package later — only if multiple apps need the same migration; otherwise keep migration in `example-frontend` initially and promote when stable.

## Notifications

None.

## UI

- **Splash / gate:** If migration is awaited before render, show existing `Spinner`/splash (example-frontend) with a deterministic short timeout and error UI if migration throws.
- No new product screens required unless cleanup fails and you expose a “Reset local data” recovery.

## Phases

### Phase 1 — Spike + interface

- Prove MMKV in `example-frontend` on iOS/Android simulators; measure cold start vs AsyncStorage persist read.
- Decide: single MMKV instance vs split (persist vs preferences).
- Document security stance: tokens remain SecureStore / web AsyncStorage.

### Phase 2 — Boot migration + example-frontend

- Implement `runAsyncStorageToMmkvMigrationOnce` (native only) + sentinel.
- Wire `redux-persist` to MMKV on native; web keeps `createSafeStorage` AsyncStorage.
- Refactor store initialization order if required by chosen migration pattern.
- Bump `persistConfig.version` and add migration notes in `example-frontend/README.md`.

### Phase 3 — @terreno/ui and Unifier / EmojiSelector / useStoredState

- Either inject storage dependency **or** add `*.native.ts` implementations that use MMKV while `*.ts` keeps AsyncStorage for web.
- Align keys with Phase 2 registry so boot migration covers them.

### Phase 4 — @terreno/rtk docs + tests

- Update `rtk/README.md` and `docs/reference/rtk.md`: clarify token storage unchanged; MMKV applies to app-chosen persist layers.
- Extend or add tests: migration idempotency, “empty AsyncStorage → no-op”, “MMKV already has data → skip copy from Async”.

### Phase 5 — MCP templates and admin-spa

- Update bootstrap templates to match the chosen storage pattern (likely still AsyncStorage for web-only admin-spa).
- Run `bun run compile` / lint across touched packages.

## Feature Flags & Migrations

- **Optional kill-switch:** `EXPO_PUBLIC_DISABLE_MMKV_MIGRATION` (or similar) to force legacy AsyncStorage path for support debugging.
- **Sentinel key:** `terreno.storageMigration.asyncStorageToMmkvV1` in MMKV.
- **Rollout:** Ship behind nothing if migration is idempotent; beta channel validation recommended.

## Activity Log & User Updates

None.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Store import runs before migration | Refactor store creation or use async `getItem` migration |
| Duplicate reads during migration | Sentinel + single-flight mutex around migration |
| Web / SSR regressions | No MMKV on web; keep `typeof window` guards |
| Secure token confusion | Explicitly exclude `AUTH_TOKEN` / `REFRESH_TOKEN` from native migration list |
| Large `persist:root` blocking JS thread | MMKV writes are fast; still chunk or `requestIdleCallback` only if profiling shows jank |

## Not included / Future work

- Encrypted MMKV for classified data.
- Shared storage across App Group extensions (iOS).
- Removing AsyncStorage dependency after all call sites support injection.

## Acceptance Criteria

- AC-1: On a native build with **only** AsyncStorage populated (simulated legacy: `persist:root` set), first launch after upgrade shows correct rehydrated Redux state from MMKV-backed persist path after migration completes.
- AC-2: Second launch does not re-copy from AsyncStorage (sentinel set); no duplicate keys in user defaults inspection (if applicable).
- AC-3: Web build behavior unchanged: login and persist still work with AsyncStorage.
- AC-4: JWT native login still stores tokens in `expo-secure-store`; no regression in `getAuthToken` on native.
- AC-5: Unit/integration tests cover migration idempotency and failure handling (AsyncStorage throws → app still starts with degraded path or clear error per policy).

---

## Task List (Bot Consumption)

*Structured task breakdown for automated implementation. Each task should be independently implementable and testable.*

### Phase 1: Spike

- [ ] **Task 1.1**: MMKV hello-world in example-frontend native
  - Description: Add dependency, write/read one key on startup, document Expo config steps.
  - Files: `example-frontend/package.json`, `example-frontend/app.json` or config plugins, `package.json` catalog
  - Depends on: none
  - Acceptance: iOS + Android simulators run without native crash; key round-trips

### Phase 2: Migration + persist

- [ ] **Task 2.1**: Implement `runAsyncStorageToMmkvMigrationOnce` (native)
  - Description: Sentinel, key registry, copy + optional cleanup; single-flight.
  - Files: `example-frontend/storage/migrateOnBoot.native.ts` (or shared package later)
  - Depends on: 1.1
  - Acceptance: Tests with mocked AsyncStorage/MMKV prove idempotency

- [ ] **Task 2.2**: MMKV redux-persist storage adapter (native) + web AsyncStorage unchanged
  - Description: `createPersistStorage()` factory switching on `Platform.OS` / `IsWeb`.
  - Files: `example-frontend/store/index.ts`, new `example-frontend/storage/persistStorage.ts`
  - Depends on: 2.1
  - Acceptance: Persist rehydrates; version bumped; offline middleware still works

- [ ] **Task 2.3**: Store init order
  - Description: Ensure migration completes before first persist read (per chosen pattern).
  - Files: `example-frontend/app/_layout.tsx` or store entry
  - Depends on: 2.2
  - Acceptance: No flash of logged-out state on upgraded installs in manual test

### Phase 3: UI package

- [ ] **Task 3.1**: `useStoredState` / `Unifier` / `EmojiSelector` native MMKV path
  - Description: Platform split or injected storage; migrate keys in boot registry.
  - Files: `ui/src/useStoredState.ts`, `ui/src/Unifier.ts`, `ui/src/EmojiSelector.tsx`, possible `*.native.ts` siblings
  - Depends on: 2.1
  - Acceptance: UI tests pass; web unchanged

### Phase 4: Docs & rtk

- [ ] **Task 4.1**: Documentation pass
  - Description: Update `rtk/README.md`, `docs/reference/rtk.md`, `docs/explanation/authentication.md`, rulesync copies if required by repo process.
  - Files: docs + `.rulesync` / `.cursor` per project convention
  - Depends on: 2.2
  - Acceptance: Docs state token vs persist storage split accurately

### Phase 5: Templates

- [ ] **Task 5.1**: MCP bootstrap store template
  - Description: Align generated `store/index` with optional MMKV comment or feature flag stub.
  - Files: `mcp-server/src/bootstrap.ts`, templates under `mcp-server/src/docs/templates/`
  - Depends on: 2.2
  - Acceptance: Generated app compiles; web path default safe
