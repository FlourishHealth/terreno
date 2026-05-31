---
name: generate-sdk
description: >-
  Regenerate the example-frontend RTK Query SDK (store/openApiSdk.ts) from the
  example-backend's OpenAPI spec. Handles dependency install, backend startup,
  SDK codegen, and cleanup from a fresh checkout. Use whenever the backend's API
  surface changes — new modelRouter routes, custom routes registered via
  createOpenApiBuilder, new/modified Mongoose models or field descriptions in
  example-backend, changes to
  permissions/queryFields/populatePaths/responseHandler, edits to @terreno/api
  routing or OpenAPI generation, or any time a route is added/removed/renamed.
  Also use when the user asks to "regenerate the SDK", "update openApiSdk.ts",
  "run bun run sdk", or reports stale/missing generated hooks.
targets:
  - '*'
---
# Generate Frontend SDK

The `example-frontend` consumes the `example-backend` API via auto-generated RTK Query hooks in `store/openApiSdk.ts`. The codegen pulls from the live backend at `http://localhost:4000/openapi.json`, so the backend must be running while `bun run sdk` executes.

**Never edit `example-frontend/store/openApiSdk.ts` by hand — it is fully overwritten by this skill.**

## When to run this skill

Run it whenever the backend's OpenAPI surface changes. Common triggers:

- New or removed `modelRouter` registration
- Edits to `permissions`, `queryFields`, `populatePaths`, `defaultQueryParams`, `sort`, `responseHandler`, or `openApiOverwrite` on an existing `modelRouter`
- New custom routes built with `createOpenApiBuilder` (path params, query params, request body, response schema changes)
- Mongoose schema changes that affect the public shape: added/removed fields, type changes, required/enum/default changes, `description` updates, ref changes
- Changes to auth routes (e.g. `addAuthRoutes`, `addMeRoutes`, GitHub OAuth, Better Auth)
- Edits to `@terreno/api` files that produce the OpenAPI spec (`openApi.ts`, `openApiBuilder.ts`, `api.ts`, `populate.ts`)
- User asks: "regenerate SDK", "update the SDK", "run bun run sdk", "openApiSdk.ts is out of date"

If the change is purely backend-internal (logging, refactor that doesn't alter routes/models, test-only edits), the SDK does **not** need regeneration — skip this skill.

## Prerequisites

- Bun is on PATH (run `bun` directly; do not modify PATH)
- Port 4000 (backend) must be free

**No local MongoDB install required.** SDK generation always starts an in-memory MongoDB via `mongodb-memory-server` (same as feature proof / `stack:dev`).

## Procedure

Run the steps in order. Stop and report on the first failure.

### 1. Verify the worktree is bootstrapped

Detect whether dependencies are installed. The repo uses Bun workspaces, so a single root `node_modules` is sufficient.

```bash
test -d node_modules && test -d example-backend/node_modules && test -d example-frontend/node_modules && echo "installed" || echo "missing"
```

If `missing`, run the full bootstrap from the repo root. This installs deps **and** compiles every workspace package (needed because `example-frontend` imports built artifacts from `@terreno/rtk` and other workspaces):

```bash
bun run bootstrap
```

Bootstrap can take a few minutes — run it in the background and wait for it to finish before continuing.

### 2. Ensure backend env vars are set

The backend reads `example-backend/.env`. If that file is missing, copy the example:

```bash
test -f example-backend/.env || cp example-backend/.env.example example-backend/.env
```

The default `.env.example` values are fine for local SDK generation. Do not invent secrets or overwrite an existing `.env`. **`MONGO_URI` in `.env` is ignored** — the stack script always uses in-memory MongoDB.

### 3. Generate the SDK (memory Mongo + backend + codegen)

From the repo root, run the all-in-one script. It starts in-memory MongoDB and the example backend, waits for `/openapi.json`, runs codegen, then stops the stack:

```bash
bun run sdk:generate
```

Do **not** use `bun run backend:dev` directly — that does not start memory MongoDB.

If port 4000 is in use, stop any stale stack first:

```bash
bun run stack:stop
```

If the script fails with a missing module error (e.g. `@rtk-query/codegen-openapi`), dependencies are stale — re-run `bun run bootstrap` from the repo root and try again.

### 4. Verify and report

Confirm `example-frontend/store/openApiSdk.ts` exists and was modified. Show the user a short summary:

- Which routes/models triggered the regeneration
- A `git diff --stat example-frontend/store/openApiSdk.ts` to show the size of the change
- Any warnings or errors emitted by the backend or codegen

Do **not** commit `openApiSdk.ts` automatically — leave that to the user's normal commit flow.

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE :::4000` | Stale backend process | `bun run stack:stop` then retry |
| Memory Mongo timeout | First run downloading Mongo binary | Wait and retry; check network |
| `Cannot find module '@rtk-query/codegen-openapi'` | Missing/stale deps | Re-run `bun run bootstrap` |
| `openApiSdk.ts` has no endpoints | Backend wasn't ready when codegen ran | Re-run `bun run sdk:generate` |
| Codegen errors on `$ref` | Backend OpenAPI spec is malformed | Inspect `/openapi.json` manually; check recent changes to `openApi.ts` or model schemas |

## Notes

- The codegen config lives at `example-frontend/openapi-config.ts`. The schema URL respects `OPENAPI_URL` if set, otherwise defaults to `http://localhost:4000/openapi.json`.
- The script entry point is `example-frontend/scripts/generate-sdk.ts` — it shells out to the `@rtk-query/codegen-openapi` CLI, then post-processes the output with Biome.
- Custom endpoints and cache tag types are layered on top in `example-frontend/store/sdk.ts` via `injectEndpoints`/`enhanceEndpoints`; that file is hand-maintained and is **not** overwritten by codegen.
- Manual alternative: `bun run stack:backend` → wait for openapi.json → `cd example-frontend && bun run sdk` → `bun run stack:stop`.
