# Task List: @terreno/syncdb-codegen

Paired with [docs/implementationPlans/syncdb-codegen.md](../implementationPlans/syncdb-codegen.md). **Delivery: single PR** — phases define implementation order only.

## Phase 1: syncdb runtime

- [ ] **Task 1.1**: Per-mutation `maxAttempts` plumbing
  - Description: Add optional `maxAttempts` to `MutateArgs`, store it as an optional cell on the outbox row, and have the replay coordinator's `error`-nack branch use `row.maxAttempts ?? MAX_ERROR_NACK_ATTEMPTS` when deciding terminal failure. Missing cell keeps current behavior.
  - Files: `syncdb/src/client.ts`, `syncdb/src/mutations/outbox.ts`, `syncdb/src/storage/schema.ts`, `syncdb/src/sync/replayCoordinator.ts`, `syncdb/src/sync/replayCoordinator.test.ts`, `syncdb/src/mutations/outbox.test.ts`
  - Depends on: none
  - Acceptance: `maxAttempts: 1` fails terminally after one error nack; omitted preserves 5-attempt exponential backoff; existing tests unchanged.

- [ ] **Task 1.2**: `createCollectionHooks` factory
  - Description: New `createCollectionHooks<TData, TCreate, TUpdate>({collection, retries})` in `@terreno/syncdb/react` returning the five per-operation hooks `{useListQuery, useReadQuery, useCreateMutation, useUpdateMutation, useDeleteMutation}`. Read hooks delegate to the existing `useQuery`/`useEntity`; mutation hooks return one-element `[trigger]` tuples whose triggers wrap `client.mutate`, mapping `retries` (false → 1, number → n, omitted → undefined) to `maxAttempts`.
  - Files: `syncdb/src/react/collectionHooks.ts` (new), `syncdb/src/react/collectionHooks.test.tsx` (new), `syncdb/src/react/index.ts`
  - Depends on: Task 1.1
  - Acceptance: factory hooks behave identically to direct hook calls; `const [create] = useCreateMutation()` destructuring compiles and works; typed create/update payloads compile; `retries` reaches the outbox row.

## Phase 2: OpenAPI extension in @terreno/api

- [ ] **Task 2.1**: Emit `x-terreno-sync` on list operations
  - Description: When `modelRouter` options include `sync`, the list operation's OpenAPI object gains `"x-terreno-sync": {collection, scope}` where `collection` is the route path without the leading slash and `scope` is the scope type ("owner" | "tenant" | "broadcast" | "custom"). Thread `routePath` into `listOpenApiMiddleware` so `collection` matches `syncRegistry` `collectionTag`.
  - Files: `api/src/openApi.ts`, `api/src/api.ts` (call site), `api/src/openApi.test.ts` (or existing spec-generation test file)
  - Depends on: none
  - Acceptance: spec for a synced model contains the extension with correct collection tag and scope; non-synced routes contain no extension; RTK codegen output for example-frontend is unchanged.

## Phase 3: codegen package

- [ ] **Task 3.1**: Package scaffold
  - Description: New `syncdb-codegen/` workspace package (`@terreno/syncdb-codegen`) with bin `terreno-syncdb-codegen` (`#!/usr/bin/env bun`), `compile`, `test`, `lint`, `publishConfig.access: public`, and `build:binary` (`bun build --compile src/cli.ts --outfile dist/terreno-syncdb-codegen`) scripts, modeled on `syncdb/` + the `mcp-server` bin pattern.
  - Files: `syncdb-codegen/package.json` (new), `syncdb-codegen/tsconfig.json` (new), `syncdb-codegen/biome.jsonc` (new), root `package.json` (workspaces + `syncdb-codegen:compile`/`syncdb-codegen:test` scripts)
  - Depends on: none
  - Acceptance: `bun run syncdb-codegen:compile` and `bun run lint` pass from the repo root.

- [ ] **Task 3.2**: Spec loading and collection discovery
  - Description: Load the OpenAPI document from a URL or file path; walk `paths` for `x-terreno-sync` extensions; resolve each collection's entity schema (list response `data` items ref), create body, and update body schema refs; apply `--collections` as filter or fallback; fail with an actionable error when no collections resolve.
  - Files: `syncdb-codegen/src/loadSpec.ts` (new), `syncdb-codegen/src/discoverCollections.ts` (new), tests, `syncdb-codegen/src/fixtures/openapi.example.json` (new, captured from example-backend)
  - Depends on: Task 2.1, Task 3.1
  - Acceptance: fixture spec yields `[{collection: "todos", entityRef, createRef, updateRef}]`; missing extensions + no flag exits non-zero.

- [ ] **Task 3.3**: Type and SDK emitters
  - Description: Emit TS interfaces from the OpenAPI schema subset produced by `mongoose-to-swagger` (objects, primitives, string-union enums, arrays, `$ref`, required lists), then assemble the output file: generated header, interfaces, `SYNC_COLLECTIONS as const`, and one destructured `createCollectionHooks` block per collection renaming factory keys to **friendly** hook names (`useListQuery: useTodos`, `useReadQuery: useTodo`, `useCreateMutation: useCreateTodo`, `useUpdateMutation: useUpdateTodo`, `useDeleteMutation: useDeleteTodo` for entity `Todo` / collection `todos`), with per-collection `retries` overrides from `--config` JSON applied. Naming: `entityName` from list-item schema `$ref` basename; `pluralName` = PascalCase collection segment. Format via `bunx biome check --write` when available; `--no-format` skips.
  - Files: `syncdb-codegen/src/emitTypes.ts` (new), `syncdb-codegen/src/emitSdk.ts` (new), `syncdb-codegen/src/deriveHookNames.ts` (new, optional), snapshot tests
  - Depends on: Task 3.2
  - Acceptance: snapshot output type-checks; todos fixture emits `useTodos`, `useTodo`, `useCreateTodo`, `useUpdateTodo`, `useDeleteTodo`; `{overrides: {todos: {retries: false}}}` appears as `retries: false` in the emitted factory call.

- [ ] **Task 3.4**: CLI entry and binary build
  - Description: `cli.ts` wires arg parsing (`util.parseArgs`) → load → discover → emit → write, with clear usage/error output and non-zero exit codes. Verify `build:binary` produces a standalone executable with identical output.
  - Files: `syncdb-codegen/src/cli.ts` (new), `syncdb-codegen/src/cli.test.ts` (new)
  - Depends on: Task 3.3
  - Acceptance: `terreno-syncdb-codegen --schema fixtures/openapi.example.json --out /tmp/out.ts` succeeds; missing required args print usage and exit 1; compiled binary output matches bin output byte-for-byte.

## Phase 4: Integration, docs, and publish

- [ ] **Task 4.1**: example-frontend integration
  - Description: Add `sync-sdk` script and `syncdb-codegen.json`, check in generated `store/syncDbSdk.ts` (todos collection only), source `SYNC_COLLECTIONS` from it in `store/syncdb.ts`, and migrate `SyncTodosScreen` to the generated hooks (`useTodos`, `useTodo`, `useCreateTodo`, `useUpdateTodo`, `useDeleteTodo`; delete the local `SyncTodo` interface). Import from `@/store/syncDbSdk`.
  - Files: `example-frontend/package.json`, `example-frontend/syncdb-codegen.json` (new), `example-frontend/store/syncDbSdk.ts` (generated), `example-frontend/store/syncdb.ts`, `example-frontend/components/SyncTodosScreen.tsx`
  - Depends on: Task 1.2, Task 3.4
  - Acceptance: `bun run sync-sdk` regenerates with no diff against an unchanged backend; syncdb Playwright e2e suite passes; `compile` passes.

- [ ] **Task 4.2**: Documentation
  - Description: Codegen section in `syncdb/README.md`, new `syncdb-codegen/README.md` (args, config format, friendly hook naming, custom-hooks pattern via `createCollectionHooks`), and a note in the RTK migration guide with RTK ↔ syncdb hook name mapping.
  - Files: `syncdb/README.md`, `syncdb-codegen/README.md` (new), `docs/how-to/migrate-rtk-to-syncdb.md`
  - Depends on: Task 4.1
  - Acceptance: docs cover install, generation, custom hooks, retries overrides, and name mapping; examples compile as written.

- [ ] **Task 4.3**: npm publish on tag
  - Description: Add `publish-syncdb-codegen` job to `.github/workflows/publish-on-tag.yml` (modeled on `publish-syncdb`): validate `NPM_TOKEN`, compile workspace deps, compile, test, `npm publish`. Wire into `update-version-on-master` and publish summary steps.
  - Files: `.github/workflows/publish-on-tag.yml`
  - Depends on: Task 3.1
  - Acceptance: workflow file lists `@terreno/syncdb-codegen` in publish summary and version-bump scripts; job mirrors `publish-syncdb` structure.
