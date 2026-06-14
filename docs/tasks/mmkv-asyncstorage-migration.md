# Tasks: MMKV migration with AsyncStorage boot migration

Parent plan: `docs/implementationPlans/mmkv-asyncstorage-migration.md`

## Phase 1: Spike

- [ ] **Task 1.1**: MMKV hello-world in example-frontend native
  - Description: Add catalog dependency, minimal read/write, Expo config notes in plan or README.
  - Files: `package.json` (catalog), `example-frontend/package.json`, native config as needed
  - Depends on: none
  - Acceptance: Simulators launch; MMKV round-trip verified manually

## Phase 2: Migration + persist

- [ ] **Task 2.1**: `runAsyncStorageToMmkvMigrationOnce` (native)
  - Description: Sentinel in MMKV; registry of keys; copy from AsyncStorage; optional `multiRemove`; mutex.
  - Files: `example-frontend/storage/migrateOnBoot.native.ts`, `example-frontend/storage/migrationKeys.ts`
  - Depends on: 1.1
  - Acceptance: Bun tests with mocks; idempotent second run

- [ ] **Task 2.2**: Persist storage factory (MMKV native / AsyncStorage web)
  - Files: `example-frontend/storage/persistStorage.ts`, `example-frontend/store/index.ts`
  - Depends on: 2.1
  - Acceptance: `persistConfig.version` incremented; rehydration works on web + native

- [ ] **Task 2.3**: Bootstrap ordering
  - Files: `example-frontend/app/_layout.tsx` and/or store module layout
  - Depends on: 2.2
  - Acceptance: Upgraded-install manual test passes; no empty first frame for auth

## Phase 3: UI

- [ ] **Task 3.1**: Native MMKV for `useStoredState`, `Unifier`, `EmojiSelector`
  - Files: under `ui/src/` per platform split or DI
  - Depends on: 2.1
  - Acceptance: `bun run ui:test` green; keys in migration registry

## Phase 4: Docs

- [ ] **Task 4.1**: Doc + diagram update for storage matrix
  - Files: `docs/reference/rtk.md`, `docs/explanation/authentication.md`, `rtk/README.md`
  - Depends on: 2.2
  - Acceptance: Reviewer can trace token vs persist paths

## Phase 5: Templates

- [ ] **Task 5.1**: MCP bootstrap alignment
  - Files: `mcp-server/src/bootstrap.ts`, related templates
  - Depends on: 2.2
  - Acceptance: Template store still defaults to safe web SSR pattern
