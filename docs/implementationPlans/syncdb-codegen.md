# Implementation Plan: @terreno/syncdb-codegen

**Status:** Draft
**Branch:** cursor/ip-syncdb-codegen-41d6
**Owner:**
**Created:** 2026-07-08

## Goal

Ship `@terreno/syncdb-codegen`: a small CLI (runnable as an npm bin under bun and buildable as a standalone compiled bun binary) that reads a backend OpenAPI spec and generates a static, typed set of syncdb hooks — the local-first analogue of the existing `@rtk-query/codegen-openapi` flow (`bun run sdk` → `store/openApiSdk.ts`).

Today syncdb consumers hand-write both the entity types and the collection strings:

```typescript
// example-frontend/components/SyncTodosScreen.tsx — all manual today
interface SyncTodo { _id: string; title?: string; completed?: boolean; created?: string; }
const todos = useQuery<SyncTodo>("todos", {sort: sortByCreatedDesc});
const {update, remove} = useMutate("todos"); // update/remove payloads are Record<string, unknown>
```

After this IP, a generated `store/syncDbSdk.ts` provides `useTodosQuery()`, `useTodosEntity(id)`, and `useTodosMutate()` with payload types derived from the same OpenAPI schemas RTK codegen uses (`Todo`, `CreateTodoBody`, `UpdateTodoBody`), plus a `SYNC_COLLECTIONS` constant that feeds `createSyncDb`. Custom hooks are supported the same way RTK supports custom endpoints: the generated file is never edited, and consumers extend it in a sibling file using the same public factory the generated code uses.

## Non-Goals

- Covering the whole syncdb surface. Only `useEntity` / `useQuery` / `useMutate` get generated per-collection wrappers. `useSyncStatus`, `useConflicts`, `useSyncDbClient`, and `SyncDbProvider` are global (not per-collection) and stay as direct imports from `@terreno/syncdb/react`.
- Runtime schema validation of mutation payloads (types are compile-time only, matching RTK codegen).
- Publishing per-platform compiled binaries to npm or GitHub releases (the compiled binary is a local/CI build target for now; `@terreno/syncdb` itself is not in `publish-on-tag.yml` yet either).
- Watch mode, incremental generation, or multi-output-file support.
- Generating Redux integration or migrating non-synced endpoints — per `docs/how-to/migrate-rtk-to-syncdb.md`, custom routes stay on RTK.

## Decisions

Options were considered where the design was genuinely open; each row records the recommendation this plan is built on. Rejected alternatives are listed so review can overrule them cheaply.

| Question | Decision |
|----------|----------|
| **How does codegen know which collections are synced?** OpenAPI does not mark sync today; the server-side `syncRegistry` (`api/src/sync/registry.ts`) is in-memory only. Options: (a) emit an `x-terreno-sync` vendor extension on the list path from `modelRouter` when `options.sync` is set; (b) require an explicit `--collections` CLI arg; (c) add a `GET /sync/config` manifest endpoint. | **(a) with (b) as override.** The extension is a ~10-line change in `@terreno/api`'s list OpenAPI middleware, keeps the spec the single input (same as RTK codegen), and can't drift from the backend. `--collections` remains as an explicit filter/override for apps that sync a subset. (c) adds server surface for no extra information and is rejected. |
| **How is "retries vs not" expressed?** RTK disables retries per-endpoint via `extraOptions: {maxRetries: 0}` (see `rtk/src/authSlice.ts`). syncdb retries live in the replay engine: `MAX_ERROR_NACK_ATTEMPTS = 5` with exponential backoff in `syncdb/src/sync/replayCoordinator.ts`, not configurable per mutation. Options: (a) plumb an optional per-mutation `maxAttempts` through `client.mutate` → outbox row → replay coordinator, and expose `retries` in the codegen config; (b) codegen-only option that is silently ignored until the engine supports it. | **(a).** Small, contained change: `MutateArgs.maxAttempts?`, one optional outbox cell, one `??` in the replay coordinator's error-nack branch. `retries: false` maps to `maxAttempts: 1` (fail fast, like RTK's `maxRetries: 0`), a number maps directly, and omitted keeps the engine default of 5. (b) would generate config that lies. Note syncdb mutations are idempotent via `mutationId`, so unlike RTK the motivation is fail-fast UX (surface a terminal failure immediately), not duplicate-write safety. |
| **Config surface: flags only, or a config file?** The binary should "take a few args", but per-collection overrides (retries, exclusions) don't map well to flags. | **Flags for the common path, optional JSON config for overrides.** `--schema`, `--out`, `--collections` cover the RTK-equivalent happy path. `--config ./syncdb-codegen.json` adds `{overrides: {<collection>: {retries?: boolean \| number}}, exportName?, sdkImportPath?}`. JSON (not TS) because a compiled bun binary cannot reliably import arbitrary consumer TypeScript at runtime; RTK's TS `ConfigFile` needs the `tsx`/`TS_NODE_PROJECT` dance we currently work around in `example-frontend/scripts/generate-sdk.ts`. |
| **How are TS types emitted from OpenAPI schemas?** Options: (a) a small hand-rolled emitter for the subset `mongoose-to-swagger` actually produces (objects, primitives, enums as string unions, arrays, `$ref`); (b) depend on `openapi-typescript` or oazapfts. | **(a).** The @terreno/api spec is a narrow, known dialect; a ~150-line emitter with snapshot tests keeps the binary dependency-free and small. If the emitter grows past that dialect, revisit (b). |
| **Where does the shared hook factory live?** Generated code and custom hooks must be built the same way (the RTK parallel: generated `injectEndpoints` and app `sdk.ts` both build on `emptySplitApi`). Options: (a) new `createCollectionHooks` export in `@terreno/syncdb/react`; (b) inline the factory into every generated file; (c) a runtime export of `@terreno/syncdb-codegen`. | **(a).** One implementation, versioned with the hooks it wraps, and consumers already depend on `@terreno/syncdb`. (b) duplicates logic into generated output; (c) would make the codegen package a runtime dependency of apps, which it should never be. |
| **Hook naming.** Singularizing collection tags (`todos` → `useTodoEntity`) requires inflection rules that break on words like `statuses`. | **No singularization.** Deterministic pascal-case of the collection tag: `useTodosQuery`, `useTodosEntity`, `useTodosMutate`. Entity/type names come from the OpenAPI component schema names, which are already singular model names (`Todo`, `CreateTodoBody`, `UpdateTodoBody`). |
| **Distribution.** "Compiled bun binary" vs npm reality. | **Both, npm-bin first.** The package ships `"bin": {"terreno-syncdb-codegen": "./dist/cli.js"}` with a `#!/usr/bin/env bun` shebang (the `@terreno/mcp` pattern), plus a `build:binary` script running `bun build --compile src/cli.ts --outfile dist/terreno-syncdb-codegen` (the `example-backend/Dockerfile` pattern) for standalone use. Publishing platform binaries is future work. |

## Architecture

```
example-backend                                example-frontend
  modelRouter("/todos", Todo, {sync: {...}})     bun run sync-sdk
    └─ list OpenAPI middleware emits               └─ terreno-syncdb-codegen
       x-terreno-sync on GET /todos                     --schema http://localhost:4000/openapi.json
            │                                           --out ./store/syncDbSdk.ts
            ▼                                                │
      /openapi.json  ──── fetch/read ────────────────────────┘
                                                             │ emits
                                                             ▼
                                              store/syncDbSdk.ts   (generated, never edited)
                                                ├─ interface Todo / CreateTodoBody / UpdateTodoBody
                                                ├─ export const SYNC_COLLECTIONS = ["todos"] as const
                                                └─ export const {useTodosQuery, useTodosEntity,
                                                     useTodosMutate} = createCollectionHooks<...>({
                                                       collection: "todos", retries: ...})
                                                             │ extended by (custom hooks)
                                                             ▼
                                              store/syncSdk.ts    (hand-written, optional)
                                                └─ createCollectionHooks<LocalNote>({collection: "notes"})
```

Three packages change:

1. **`@terreno/syncdb`** (runtime): `createCollectionHooks` factory in `src/react/`, plus per-mutation `maxAttempts` plumbing through `client.mutate` → outbox → replay coordinator.
2. **`@terreno/api`**: `listOpenApiMiddleware` (or the shared path-building step in `api/src/openApi.ts`) adds `"x-terreno-sync": {collection, scope}` to the list operation when `options.sync` is present.
3. **`@terreno/syncdb-codegen`** (new): CLI that parses the spec, discovers synced collections, and emits the SDK file.

### Runtime factory (`@terreno/syncdb/react`)

```typescript
export interface CollectionHooksConfig {
  collection: string;
  /** false → 1 attempt (fail fast); number → max replay attempts; omitted → engine default (5). */
  retries?: boolean | number;
}

export interface CollectionHooks<TData, TCreate, TUpdate> {
  useQuery: (options?: UseQueryOptions<TData>) => TData[];
  useEntity: (id: string) => UseEntityResult<TData>;
  useMutate: () => {
    create: (args: {data: TCreate}) => {mutationId: string; id: string};
    update: (args: {id: string; data: TUpdate}) => {mutationId: string; id: string};
    remove: (args: {id: string}) => {mutationId: string; id: string};
  };
}

export const createCollectionHooks = <
  TData = Record<string, unknown>,
  TCreate = Record<string, unknown>,
  TUpdate = Partial<TCreate>,
>(config: CollectionHooksConfig): CollectionHooks<TData, TCreate, TUpdate> => { ... };
```

It delegates to the existing `useQuery`/`useEntity`/`useMutate` (no listener logic duplicated) and threads `retries` into `client.mutate` as `maxAttempts`. This is the `emptySplitApi` of the syncdb world: generated code calls it, and custom hooks call it directly — that is the whole "custom hooks the same way RTK does" story.

### Generated file shape

```typescript
// store/syncDbSdk.ts — GENERATED by @terreno/syncdb-codegen. Do not edit.
import {createCollectionHooks} from "@terreno/syncdb/react";

export interface Todo { _id: string; title: string; completed: boolean; ownerId: string; created: string; updated: string; }
export interface CreateTodoBody { title: string; completed?: boolean; }
export type UpdateTodoBody = Partial<CreateTodoBody>;

/** Collections with sync enabled on the backend; pass to createSyncDb. */
export const SYNC_COLLECTIONS = ["todos"] as const;

export const {
  useQuery: useTodosQuery,
  useEntity: useTodosEntity,
  useMutate: useTodosMutate,
} = createCollectionHooks<Todo, CreateTodoBody, UpdateTodoBody>({collection: "todos"});
```

`SYNC_COLLECTIONS` replaces the hand-maintained list in `example-frontend/store/syncdb.ts`, closing the "client string must match backend route" gap.

### CLI

```
terreno-syncdb-codegen --schema <url|path> --out <file> [--collections a,b] [--config <json>] [--no-format]
```

- `--schema` (required): OpenAPI URL or local JSON file (same source as `openapi-config.ts`'s `schemaFile`).
- `--out` (required): output `.ts` path.
- `--collections` (optional): comma-separated allowlist; also the fallback when the spec has no `x-terreno-sync` extensions (older backends). Errors clearly if neither extensions nor the flag identify any collection.
- `--config` (optional): JSON file with `{overrides: {todos: {retries: false}}}` per-collection settings.
- `--no-format` (optional): skip the biome/prettier formatting pass (codegen formats output via `Bun.spawn`-ed `bunx biome check --write` when available, mirroring `generate-sdk.ts`; falls back to raw emit).

## Models

No Mongoose model changes. One local-storage schema change in syncdb: the `_outbox` reserved table gains an optional `maxAttempts` numeric cell (`syncdb/src/storage/schema.ts`, `syncdb/src/mutations/outbox.ts`). Missing cell means engine default, so existing persisted stores need no migration.

## APIs

No new HTTP endpoints. One OpenAPI spec addition in `@terreno/api`: list operations of sync-enabled model routers gain

```json
"x-terreno-sync": {"collection": "todos", "scope": "owner"}
```

Vendor extensions are legal OpenAPI and ignored by the RTK codegen, Swagger UI, and the AJV validator, so this is backward-compatible.

## Notifications

None needed.

## UI

No new screens. `example-frontend/components/SyncTodosScreen.tsx` swaps its hand-rolled `SyncTodo` interface and string-based hooks for the generated `useTodosQuery`/`useTodosMutate`, and `store/syncdb.ts` imports `SYNC_COLLECTIONS` from the generated file. Behavior is unchanged; the existing syncdb Playwright e2e suite is the regression net.

## Phases

Single PR is plausible but the work splits cleanly into four phases if review prefers smaller units:

1. **syncdb runtime** — `createCollectionHooks` + `maxAttempts` plumbing (mutate → outbox → replay coordinator), with unit tests. No consumer-visible breaking changes.
2. **api spec extension** — `x-terreno-sync` on list operations, with an OpenAPI generation test asserting the extension appears for `example-backend`-style sync configs and is absent otherwise.
3. **codegen package** — new `syncdb-codegen/` workspace package: arg parsing, spec loading, collection discovery, type emitter, file emitter, snapshot tests against a fixture spec captured from `example-backend`, `build:binary` script.
4. **integration + docs** — `example-frontend` `sync-sdk` script and screen migration; README updates (`syncdb/README.md`, new `syncdb-codegen/README.md`, `docs/how-to/migrate-rtk-to-syncdb.md` note); root `package.json` convenience scripts.

## Feature Flags & Migrations

- No new feature flags. The existing `use-syncdb` flag continues to gate the syncdb path in `example-frontend`.
- No data migrations. The new `_outbox.maxAttempts` cell is optional and defaulted.
- Publishing: not wired into `publish-on-tag.yml` in this IP (neither is `@terreno/syncdb` yet); tracked in Future Work so both are added together.

## Activity Log & User Updates

None — developer tooling only.

## Not Included / Future Work

- Publishing `@terreno/syncdb` and `@terreno/syncdb-codegen` to npm (add `publish-syncdb` + `publish-syncdb-codegen` jobs to `publish-on-tag.yml`).
- Per-platform prebuilt binaries as release artifacts.
- Generated wrappers for `useSyncStatus`/`useConflicts` (no per-collection typing to add).
- Server-driven filters/sorts in `useQuery` options (syncdb filters run client-side in JS; nothing for codegen to type beyond `TData`).
- Zod/AJV runtime validation of mutation payloads against the OpenAPI schema.
- Singular/custom hook naming via config (`overrides.todos.hookName`), if the pascal-case default proves awkward.
- A `--watch` mode.

## Files to Create / Modify

**Create**
- `syncdb-codegen/package.json` — name `@terreno/syncdb-codegen`, `bin`, `build:binary`, catalog deps (dev-only: typescript, biome).
- `syncdb-codegen/tsconfig.json`, `syncdb-codegen/biome.jsonc` — copied from `syncdb/` siblings.
- `syncdb-codegen/src/cli.ts` — `#!/usr/bin/env bun` entry; arg parsing (`Bun.argv` + `util.parseArgs`), exit codes, error messages.
- `syncdb-codegen/src/loadSpec.ts` — fetch/read + JSON parse of the OpenAPI document.
- `syncdb-codegen/src/discoverCollections.ts` — walk `paths`, collect `x-terreno-sync` operations, resolve entity/create/update schema refs from the list/create/patch operations; apply `--collections` filter/fallback.
- `syncdb-codegen/src/emitTypes.ts` — OpenAPI schema subset → TS interfaces.
- `syncdb-codegen/src/emitSdk.ts` — assemble the output file (header, types, `SYNC_COLLECTIONS`, `createCollectionHooks` calls with overrides applied).
- `syncdb-codegen/src/*.test.ts` — unit + snapshot tests against `syncdb-codegen/src/fixtures/openapi.example.json`.
- `syncdb-codegen/README.md` — usage, args, config format, custom-hooks pattern.
- `example-frontend/syncdb-codegen.json` — per-collection overrides example (todos with default retries).

**Modify**
- `syncdb/src/react/collectionHooks.ts` (new file in existing package) + `syncdb/src/react/index.ts` — `createCollectionHooks` export.
- `syncdb/src/client.ts` — `MutateArgs.maxAttempts?`, pass-through to outbox.
- `syncdb/src/mutations/outbox.ts`, `syncdb/src/storage/schema.ts` — optional `maxAttempts` cell.
- `syncdb/src/sync/replayCoordinator.ts` — `row.maxAttempts ?? MAX_ERROR_NACK_ATTEMPTS` in the error-nack branch.
- `api/src/openApi.ts` (`listOpenApiMiddleware`) — emit `x-terreno-sync` when `options.sync` is set.
- `example-frontend/package.json` — `"sync-sdk": "terreno-syncdb-codegen --schema ... --out ./store/syncDbSdk.ts --config ./syncdb-codegen.json"` script; add `@terreno/syncdb-codegen` as a workspace dev dependency.
- `example-frontend/store/syncDbSdk.ts` — generated output (checked in, like `openApiSdk.ts`).
- `example-frontend/store/syncdb.ts` — import `SYNC_COLLECTIONS` from the generated file.
- `example-frontend/components/SyncTodosScreen.tsx` — use generated hooks; delete the local `SyncTodo` interface.
- Root `package.json` — workspace entry + `syncdb-codegen:compile` / `syncdb-codegen:test` scripts.
- `syncdb/README.md`, `docs/how-to/migrate-rtk-to-syncdb.md` — codegen sections.

## Task List

See [docs/tasks/syncdb-codegen.md](../tasks/syncdb-codegen.md).

## Acceptance Criteria

- [ ] `createCollectionHooks<Todo>({collection: "todos"})` returns hooks whose behavior matches direct `useQuery`/`useEntity`/`useMutate` calls (covered by unit tests in `syncdb/src/react/`).
- [ ] `createCollectionHooks({collection: "todos", retries: false})` produces mutations whose outbox rows fail terminally after a single `error` nack; `retries: 3` fails after three attempts; omitted keeps the current 5-attempt backoff (replay coordinator tests).
- [ ] `GET /openapi.json` from a backend with `sync: {scope: {type: "owner"}}` on `/todos` includes `x-terreno-sync: {collection: "todos", scope: "owner"}` on the list operation; non-synced routes have no extension (api test).
- [ ] `terreno-syncdb-codegen --schema <fixture> --out out.ts` emits a file that type-checks under the example-frontend tsconfig, contains `SYNC_COLLECTIONS`, typed interfaces, and one `createCollectionHooks` block per synced collection (snapshot test).
- [ ] `--collections todos` filters output to that collection; a spec without extensions and no `--collections` flag exits non-zero with an actionable message.
- [ ] A config file with `{overrides: {todos: {retries: false}}}` produces `createCollectionHooks<...>({collection: "todos", retries: false})` in the output.
- [ ] `bun run build:binary` in `syncdb-codegen/` produces a standalone executable that generates identical output to the bin entry.
- [ ] `bun run sync-sdk` in `example-frontend` (backend running) regenerates `store/syncDbSdk.ts` with no diff when the backend is unchanged; SyncTodosScreen works against the generated hooks (existing syncdb e2e suite passes).
- [ ] `bun run lint`, `bun run syncdb:test`, `bun run api:test`, and the new `syncdb-codegen:test` pass.
