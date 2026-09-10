# Run MongoDB migrations

Use `terreno-migrate` for schema and data changes that must run once per environment. Keep ad-hoc admin scripts for one-off maintenance.

## Add a file

Put TypeScript modules in `migrations/`:

```text
migrations/20260910120000-add-todos-index.ts
```

The exported `id` must match the filename stem. `up` is required; `down` is optional.

```typescript
export const id = "20260910120000-add-todos-index";

export const up = async ({dryRun, mongoose}): Promise<void> => {
  if (dryRun) {
    return;
  }
  await mongoose.connection.collection("todos").createIndex({owner: 1});
};

export const down = async ({dryRun, mongoose}): Promise<void> => {
  if (dryRun) {
    return;
  }
  await mongoose.connection.collection("todos").dropIndex("owner_1");
};
```

## Commands

`terreno-migrate` is the `@terreno/api` bin. `up`, `down`, and `status` need `MONGO_URI` or `MONGODB_URI`.

| Command | Mongo | Effect |
|---------|-------|--------|
| `terreno-migrate check --dir ./migrations` | No | Load and validate files (CI) |
| `terreno-migrate status --dir ./migrations` | Yes | List applied and pending ids |
| `terreno-migrate up --dir ./migrations [--dry] [--force]` | Yes | Apply pending `up` in filename order |
| `terreno-migrate down --dir ./migrations [--dry] [--force] [--steps N]` | Yes | Roll back the last `N` applied files (default 1) |

`--dry` calls `up`/`down` with `dryRun: true` and does **not** write `terreno_migrations` history. Authors must no-op writes when `dryRun` is true.

`down` fails with `Migration has no down` when the target file omits `down`. History stays unchanged.

`generate` (schema snapshot) is not in this slice yet.

## Production wet apply

`NODE_ENV=production` wet `up`/`down` requires both:

1. `ALLOW_MIGRATIONS=true`
2. `--force`

Dry-run is allowed in production without those. Non-production wet apply does not need `--force`.

## History and lock

Applied ids live in Mongo collection `terreno_migrations` (lock row `_id: "_lock"`). Do not wipe that collection in seed `--reset`. See [Seed a database](seed-a-database.md).
