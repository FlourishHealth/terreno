# Custom Routes — Terreno

Do **not** add `app.get`, `app.post`, `router.get`, or `router.post` for application
APIs. Put named operations on `modelRouter` as `collectionActions` or
`instanceActions`. Architecture: `docs/explanation/model-router-actions.md`.

## Default: modelRouter actions

```typescript
export const todoRouter = modelRouter("/todos", Todo, {
  collectionActions: {
    bulkComplete: {
      method: "POST",
      permissions: [Permissions.IsAuthenticated],
      body: z.object({ids: z.array(z.string()).min(1)}).strict(),
      handler: async ({body, user}) => {
        return {matched: 0, modified: 0};
      },
      summary: "Mark multiple todos complete",
    },
  },
  instanceActions: {
    markComplete: {
      method: "POST",
      permissions: [Permissions.IsOwner],
      handler: async ({doc}) => {
        doc.completed = true;
        await doc.save();
        return doc;
      },
    },
  },
  permissions: { /* CRUD */ },
});
```

- `POST /todos/bulkComplete` → `collectionActions.bulkComplete`
- `POST /todos/:id/markComplete` → `instanceActions.markComplete`
- `GET /settings/gcs` → `collectionActions.gcs` on a router mounted at `/settings`

Actions share permissions, `{data}` wrapping, and OpenAPI with CRUD. Return a value from
the handler; do not call `res.json` unless you are streaming.

CRUD itself is `modelRouter` create/list/read/update/delete — not a custom Express
method and not an action.

## Allowed Express `app.get` / `app.post`

| Case | Use |
|------|-----|
| Inbound provider webhooks | `WebhooksApp` |
| Static SPA / assets | plugin `app.use` / `express.static` |
| Framework auth, health, version-check | existing plugins |
| SSE / streaming GPT | handler that writes `res` itself |
| Tests and harnesses | raw Express is fine |

PATCH/DELETE that is not CRUD should be a POST action (`clearGcs`, not `DELETE /settings/gcs`).

## Last resort: `createOpenApiBuilder`

Only when the path cannot be `/{actionName}` or `/:id/{actionName}` and the table above
does not apply.

```typescript
import {
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  APIError,
} from "@terreno/api";

export const addLegacyStatsRoutes = (router: Router, options?: OpenApiOptions): void => {
  router.get("/stats/summary", [
    authenticateMiddleware(),
    createOpenApiBuilder(options)
      .withTags(["stats"])
      .withSummary("Get summary statistics")
      .withResponse(200, {
        totalTodos: {type: "number"},
        completedTodos: {type: "number"},
      })
      .build(),
  ], asyncHandler(async (req, res) => {
    const total = await Todo.countDocuments();
    const completed = await Todo.countDocuments({completed: true});
    return res.json({data: {totalTodos: total, completedTodos: completed}});
  }));
};
```

Prefer attaching that work as `collectionActions.summary` on the Todo router instead.

## Builder methods

- `withTags(["tag"])`
- `withSummary("Brief title")`
- `withDescription("Longer explanation")`
- `withPathParameter("id", {type: "string"})`
- `withQueryParameter("limit", {type: "number"}, {required: false})`
- `withRequestBody({field: {type: "string", required: true}})`
- `withResponse(200, {field: {type: "string"}})`
- `withArrayResponse(200, {type: "object"})`

## Webhooks

Do not add inbound provider callbacks with `createOpenApiBuilder` or JWT
`authenticateMiddleware`. Register them on `WebhooksApp` and verify `req.rawBody`.

```typescript
import {hmacSignature, WebhooksApp} from "@terreno/api";

const webhooks = new WebhooksApp({idempotency: {store: "mongo"}});
webhooks.route({
  path: "/webhooks/example",
  source: "example",
  verify: hmacSignature({secret: process.env.WEBHOOK_SECRET!, header: "X-Webhook-Signature"}),
  eventId: (req) => String((req.body as {id?: string})?.id ?? ""),
  handler: async () => undefined,
});

new TerrenoApp({userModel: User}).register(webhooks).start();
```

Pass the same `WebhooksApp` into `CommsApp` before `webhooks.register` for Twilio and
SendGrid. See `docs/how-to/inbound-webhooks.md`. Stripe billing stays
`POST /billing/webhooks/stripe` on `billing-stripe`.

## After adding an action

1. Confirm `/openapi.json` includes `/{collection}/{actionName}` or `/{collection}/{id}/{actionName}`
2. Run `generate-sdk` in the frontend
3. Add tests with supertest
