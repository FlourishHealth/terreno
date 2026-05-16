# Research: modelRouter Actions

## Summary

`modelRouter` already has the right shape for actions to slot into cleanly:

- `options.endpoints(router)` callback runs **before** CRUD route registration, so custom routes can shadow CRUD paths. (`api/src/api.ts:507`)
- Permission middleware **auto-loads `req.obj`** for `/:id` routes — instance actions get the document for free, plus existing 404/soft-delete behavior. (`api/src/api.ts:148–210`)
- `asyncHandler` + `apiErrorMiddleware` already wrap every CRUD route. (`api/src/api.ts:1208–1291`, `api/src/api.ts:1176`)
- OpenAPI today is **Mongoose-driven** via `mongoose-to-swagger`. Actions need a parallel **Zod → OpenAPI** path. This is the largest new piece. (`api/src/openApi.ts:116–161`)
- `createOpenApiBuilder` is the existing fluent builder for custom OpenAPI routes — actions reuse/extend that pattern internally so per-action OpenAPI emission stays consistent. (`api/src/openApiBuilder.ts`)

## Decisions captured from clarifying questions

| # | Decision |
|---|---|
| Methods | POST + GET |
| Schemas | Zod (input + output), used for both runtime validation and OpenAPI |
| Doc loading | Auto-load on instance actions; 404 if missing; pass via `ctx.doc` |
| Permissions | Same shape as modelRouter CRUD `PermissionMethod<T>` array; **required**, throws at register time if omitted |
| Handler | RORO: `async ({req, res, doc, body, query, user}) => result` |
| Config | Top-level `instanceActions` and `collectionActions` records on `ModelRouterOptions` |
| URL | Action name verbatim (e.g. `bulkArchive` → `/bulkArchive`) |
| Response | Handler returns raw data; framework auto-wraps in `{data: ...}` (no `responseHandler`) |
| OpenAPI tag | Default to model tag; per-action `tag` override |
| Collisions | Throw at register time on conflicts with CRUD paths or array-field operations |
| Hooks | No pre/post hooks on actions |

## Context

| Concern | Current state | File |
|---|---|---|
| modelRouter entry | `modelRouter(path, model, options) → ModelRouterRegistration` with `_buildWithOpenApi` rebuild hook | `api/src/api.ts:466` |
| Custom routes today | `options.endpoints(router)` callback; runs first so it can shadow CRUD | `api/src/api.ts:507` |
| Permissions | Array of `PermissionMethod<T> = (method, user?, obj?) => bool` per REST verb. AND-semantics | `api/src/permissions.ts:34` |
| `IsOwner` two-phase | Returns `true` when `obj` is undefined (pre-load); checks `ownerId` after middleware loads doc | `api/src/permissions.ts:53` |
| Doc auto-load | Permission middleware does `findById` + populate, attaches to `(req as any).obj` for `/:id` routes; 404 on missing or soft-deleted | `api/src/api.ts:148–210` |
| `asyncHandler` | Wraps `(req, res, next) → Promise`, catches rejections → `next(err)`; optional `bodySchema`/`querySchema` validation chain | `api/src/api.ts:1208–1291` |
| Error envelope | `APIError({status, title, detail?, code?, fields?, meta?})` + `apiErrorMiddleware` registered on every modelRouter | `api/src/errors.ts:1–132`, `api/src/api.ts:1176` |
| OpenAPI generation | Per-verb middlewares (`listOpenApiMiddleware`, `createOpenApiMiddleware`, …) built from Mongoose via `mongoose-to-swagger` | `api/src/openApi.ts:116–161` |
| OpenAPI tag default | `model.collection.collectionName` | `api/src/openApi.ts:156` |
| Custom-route OpenAPI | `createOpenApiBuilder(options).withTags(...).withResponse(...).build()` fluent builder | `api/src/openApiBuilder.ts` |
| Validation | Opt-in `validation: true` option enables AJV/OpenAPI validation (`validateRequestBody`, `validateQueryParams`) | `api/src/openApiValidator.ts` |
| Tests | `bun:test` + `supertest` + `setupDb()` + `authAsUser()` per file | `api/src/api.test.ts` etc. |

## Findings

1. **`endpoints` is the existing extension point.** `consentApp.ts:56` already hand-rolls actions inside it. This is exactly the boilerplate we're eliminating — it becomes a migration target in the same PR.

2. **Permission middleware already loads docs for `/:id` routes.** For instance actions, we factor the existing load-doc-then-check-permission flow into a reusable helper keyed on the action's permission array (rather than the model's `update`/`read` arrays).

3. **No Zod in `@terreno/api` today.** Adding `@asteasolutions/zod-to-openapi` is required. It coexists cleanly with `mongoose-to-swagger` since action schemas are independent of the model's CRUD schemas.

4. **OpenAPI rebuild hook exists.** `ModelRouterRegistration._buildWithOpenApi` is called by `TerrenoApp` after all routers are assembled — actions register their operations during this rebuild.

5. **`responseHandler` is for model documents.** Actions return arbitrary data and should bypass it; framework just wraps in `{data: ...}` to match the CRUD response envelope.

6. **Soft-delete-aware doc loading** returns 404 with metadata. Instance actions inherit this via the shared helper, not by reimplementation.

7. **Array operations register `POST /:id/:field`** (`api/src/api.ts:1159–1175`). Action names must not collide with array field names — we detect this at register time.

8. **No bulk operations** (TODO at `api/src/api.ts:60`). Collection actions become the natural home for bulk patterns once shipped.

9. **Existing OpenAPI validator is AJV/JSON-Schema based.** The Zod path for actions is parallel — Zod schemas validate request bodies at the action middleware, and `zod-to-openapi` converts them for the spec. No collision with `configureOpenApiValidator`.

## Options Considered

| # | Approach | Pros | Cons | Effort |
|---|---|---|---|---|
| A | **Recommended.** New top-level `instanceActions` / `collectionActions` options; reuses the existing `endpoints` slot internally; leaves raw `endpoints` as an escape hatch | Clean public API. Matches chosen config shape. Doesn't break existing call sites | Two ways to add custom routes; need docs explaining when to use each | Medium |
| B | Replace `endpoints` entirely with `instanceActions`/`collectionActions` | One way to do it | Breaking change. Forces migration of all callers in same PR | Large |
| C | Extend `endpoints` callback with helper methods (`router.action(...)`) | Minimal new public surface | Awkward signature; doesn't match chosen config shape; harder to introspect for OpenAPI | Small |

## Recommendation

**Option A.** Three layered concerns:

1. **Route registration** — register actions inside the existing pre-CRUD slot, using the same `asyncHandler` + `apiErrorMiddleware` plumbing.
2. **Permission + doc-load wiring** — extract a reusable helper from `permissionMiddleware` that loads the doc and runs an arbitrary permission array. Reuse for instance actions; CRUD continues to use the keyed-by-verb path.
3. **OpenAPI** — add `@asteasolutions/zod-to-openapi`, register action operations during `_buildWithOpenApi`. Per-action `tag` override; default to model tag.

Migrate `consentApp.ts` to the new API in the same PR as a dogfooding pass.

## References

- `api/src/api.ts:466` — modelRouter entry
- `api/src/api.ts:105–314` — full options interface
- `api/src/api.ts:148–210` — permission middleware doc-load
- `api/src/api.ts:507` — endpoints registration order
- `api/src/api.ts:1208–1291` — asyncHandler
- `api/src/api.ts:1159–1175` — array operations
- `api/src/permissions.ts:34–81` — Permissions
- `api/src/openApi.ts:116–161` — OpenAPI middleware factory
- `api/src/openApiBuilder.ts` — fluent OpenAPI builder for custom routes
- `api/src/consentApp.ts:56–161` — example of hand-rolled actions (migration target)
- `api/src/errors.ts:1–132` — APIError
- `api/src/openApiValidator.ts` — validation middleware
