---
name: mongoose-schema-safety
description: >-
  Invoke when making any Mongoose schema change: adding/removing/renaming
  fields, creating a new model, adding indexes, or writing a backfill migration.
  Provides the five-type pattern, risk matrix, type file checklist, and rollout
  safety steps for Terreno backends.
---
# Mongoose Schema Safety — Terreno

Typical Terreno apps keep models under `backend/src/models/` and types under `backend/src/types/models/`. The Terreno monorepo also uses `example-backend/` and `@terreno/ai` — adjust paths below to match your repo.

## Where Schemas and Types Live

| Package | Schemas | Types |
|---------|---------|-------|
| `@terreno/api` (built-in models like `User`, `ConsentForm`) | `api/src/models/*.ts` | `api/src/types/*.ts` (or co-located in the model file via `mongoose.Schema<Doc, Model, Methods>` generics) |
| `example-backend` (`User`, `Todo`, `Configuration`) | `example-backend/src/models/*.ts` | `example-backend/src/types/models/*.ts` (`userTypes.ts`, `todoTypes.ts`, …) |
| `@terreno/ai` (`AIRequest`, `GptHistory`) | `ai/src/models/*.ts` | `ai/src/types/index.ts` |

Every field in every schema **must** have a `description` (see the API rule `01-model-field-descriptions.md`). Descriptions flow through to the OpenAPI spec via `mongoose-to-swagger`.

## The Five-Type Pattern

Every model has manually-maintained TypeScript types. **Types are NOT auto-generated** — every schema change must include a matching type update in the same commit/PR.

```typescript
import type {DefaultDoc, DefaultModel, DefaultStatics} from "@terreno/api";

// 1. Instance methods (on the document)
export type YourModelMethods = {
  customMethod: (this: YourModelDocument, param: string) => Promise<void>;
};

// 2. Static methods (on the model class) — extend DefaultStatics for findExactlyOne / findOneOrNone
export type YourModelStatics = DefaultStatics<YourModelDocument> & {
  customStatic: (this: YourModelModel, param: string) => Promise<YourModelDocument>;
};

// 3. Model type combining document + statics
export type YourModelModel = DefaultModel<YourModelDocument> & YourModelStatics;

// 4. Schema type
export type YourModelSchema = mongoose.Schema<YourModelDocument, YourModelModel, YourModelMethods>;

// 5. Document type (the shape of a single record)
export type YourModelDocument = DefaultDoc & YourModelMethods & {
  fieldName: string;
  optionalField?: number;
  enumField: "value1" | "value2";
};
```

Follow existing type files in `example-backend/src/types/models/` and `ai/src/types/index.ts` for naming and structure.

## Statics & Methods — Direct Assignment

Define statics and methods by direct assignment on the schema — not via `.method()` / `.static()` / `.add()`:

```typescript
schema.methods = {
  getDisplayName(this: YourModelDocument): string {
    return this.name;
  },
};
schema.statics = {
  async findByEmail(this: YourModelModel, email: string) {
    return this.findOneOrNone({email});
  },
};
```

## Critical Mongoose Rules

- **Never use `Model.findOne`** — use `Model.findExactlyOne` (throws on 0 or many) or `Model.findOneOrNone` (throws on many). These come from the `findExactlyOne` / `findOneOrNone` plugins in `@terreno/api`.
- Apply the standard plugins (`createdUpdatedPlugin`, `isDeletedPlugin`, `findOneOrNone`, `findExactlyOne`) on every new model. Most existing models go through `addDefaultPlugins`.
- `checkModelsStrict()` runs at non-prod startup (`server.ts`) and validates schema consistency — keep it passing.

## Schema Change Risk Matrix

| Change Type | Risk Level | Required Mitigation |
|-------------|-----------|---------------------|
| Add optional field | Low | Safe to ship directly (still requires `description`) |
| Add required field | High | Must provide a default value, OR write a backfill migration script first |
| Remove field | Medium | Soft-remove first (mark optional, stop writing); hard-remove in next PR after deploys settle |
| Rename field | High | Three-step: add new → backfill → remove old (separate PRs) |
| Change field type | Critical | Treat as rename: new field + migration + remove old |
| Add index | Medium | Safe in code, but build can slow writes on large collections — coordinate with ops |
| Remove index | Low | Safe to ship directly |
| Add unique index | High | Dedup migration must run first; otherwise the index build fails on existing duplicates |

## Migration Scripts

Migration / backfill scripts live in `example-backend/src/scripts/` (e.g. `syncConsents.ts`, `seedConsents.ts`). They use the `ScriptRunner` type and `BackgroundTask` model from `@terreno/api` (`api/src/scriptRunner.ts`):

```typescript
import type {ScriptContext, ScriptResult, ScriptRunner} from "@terreno/api";

export const run: ScriptRunner = async (wetRun, ctx) => {
  const results: string[] = [];
  // ... do work ...
  if (wetRun) {
    // commit changes
  }
  return {success: true, results};
};
```

Always run with `wetRun = false` first to verify the dry-run output. Use `ctx.checkCancellation()`, `ctx.addLog()`, and `ctx.updateProgress()` for long-running tasks.

## Cross-Package Ripple

A schema change in one place often ripples:

- **API surface affected?** Regenerate the SDK with `cd example-frontend && bun run sdk` (or invoke the `generate-sdk` skill). The OpenAPI spec is derived from the schema, so the frontend hooks will go stale otherwise.
- **`modelRouter` config?** If you added/removed a field, update `queryFields`, `populatePaths`, and `responseHandler` for any router that touches the model.
- **Admin panel?** If the model is registered in `AdminApp`, update `listFields` so the table reflects the new shape.
- **Populated refs?** If another model references this one via `ObjectId` + `ref`, and the referenced document shape changed, the consumer's populated type may need updating.

## Post-Change Checklist

- [ ] All new fields have a `description` (flows to OpenAPI)
- [ ] Type file updated in the same commit/PR — field names, optionality, enum values, array types, refs, statics/methods all match the schema
- [ ] For a new model: all five types (`Document`, `Methods`, `Statics`, `Model`, `Schema`) created
- [ ] Statics/methods assigned directly on schema (`schema.statics = {...}`, `schema.methods = {...}`) — not `.static()` / `.method()`
- [ ] Other model type files checked — any model that populates this one updated if its shape changed
- [ ] Migration script written (and dry-run verified with `wetRun = false`) for any backfill
- [ ] `modelRouter` config updated (`queryFields`, `populatePaths`, `responseHandler`) if needed
- [ ] `AdminApp` `listFields` updated if the model is in the admin panel
- [ ] `bun run sdk` run from `example-frontend/` if the API response shape changed
- [ ] Test covers old-format document behavior (missing new field) if the change rolls out before a backfill
- [ ] Unique index: dedup migration written and run before the index is added
- [ ] `checkModelsStrict()` still passes (it runs on non-prod startup)
- [ ] No `Model.findOne` introduced — use `findExactlyOne` / `findOneOrNone`

## Common Pitfalls

- Adding a required field without a default — first deploy fails for documents that pre-date the field
- Skipping the type file update — TS happily compiles older callers but new ones break at runtime
- Adding a `unique` index without dedup — index build fails on collections with existing duplicates
- Renaming a field in one PR — frontend gets old field, backend writes new field, neither side is happy
- Forgetting to regenerate the SDK after a shape change — frontend types drift from reality
- Using `.method()` / `.static()` API — terreno's convention is direct assignment, and mixing styles makes types hard to maintain
