---
name: model-router-actions
description: >-
  Replace app.get/app.post/router.get/router.post application APIs with
  modelRouter collectionActions and instanceActions. Use when adding or editing
  Express routes, custom endpoints, OpenAPI handlers, or converting hand-rolled
  Express methods to Terreno actions.
---
# modelRouter actions (not app.get / app.post)

1. Find every new or existing **application** `app.get`, `app.post`, `app.patch`,
   `app.delete`, `router.get`, `router.post` in the slice.
2. Map each to `modelRouter`:
   - Document CRUD → `permissions` create/list/read/update/delete.
   - Named GET/POST on the collection → `collectionActions.{name}` (`/{actionName}`).
   - Named GET/POST on one document → `instanceActions.{name}` (`/:id/{actionName}`).
3. Return a value from the action handler. Terreno wraps `{data}` and documents OpenAPI.
4. Leave Express methods only for webhooks (`WebhooksApp`), static files, framework
   auth/health/version plugins, SSE streaming, and tests.

Done when the slice has no new `app.get`/`app.post` for application APIs, tests hit the
action paths, and `/openapi.json` lists those actions.

Architecture: `docs/explanation/model-router-actions.md`. Portable skill:
`terreno-backend-api` (`references/custom-routes.md`).
