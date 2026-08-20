# @terreno/syncdb-codegen

OpenAPI codegen for typed `@terreno/syncdb` collection hooks.

## Usage

```bash
terreno-syncdb-codegen \
  --schema http://localhost:4000/openapi.json \
  --out ./store/syncDbSdk.ts \
  --config ./syncdb-codegen.json
```

### Flags

- `--schema` (required): OpenAPI URL or local JSON path
- `--out` (required): output TypeScript file
- `--collections`: comma-separated allowlist; fallback when the spec has no `x-terreno-sync` extensions
- `--config`: JSON overrides (`{overrides: {todos: {retries: false}}}`)
- `--no-format`: skip Biome formatting

## Generated output

Per synced collection the CLI emits:

- Entity and body interfaces (`Todo`, `CreateTodoBody`, `UpdateTodoBody`)
- `SYNC_COLLECTIONS` for `createSyncDb`
- Friendly hooks: `useTodos`, `useTodo`, `useCreateTodo`, `useUpdateTodo`, `useDeleteTodo`

Custom hooks: import `createCollectionHooks` from `@terreno/syncdb/react` in a hand-written sibling file (never edit the generated file).

The package `main` is the CLI module (`parseCliArgs`, `runCodegen`). Generated hooks still come from `@terreno/syncdb/react`, not this package.

## Binary build

```bash
bun run build:binary
```

Produces `dist/terreno-syncdb-codegen` for standalone use without a project install.
