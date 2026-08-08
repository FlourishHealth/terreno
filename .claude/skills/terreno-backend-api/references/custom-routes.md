# Custom Routes — Terreno

Use `createOpenApiBuilder` for endpoints that are not standard CRUD.

## Basic pattern

```typescript
import {
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  APIError,
} from "@terreno/api";

export const addStatsRoutes = (router: Router, options?: OpenApiOptions): void => {
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

```typescript
router.post("/webhooks/stripe", [
  createOpenApiBuilder(options)
    .withTags(["webhooks"])
    .withSummary("Stripe webhook handler")
    .withResponse(200, {received: {type: "boolean"}})
    .build(),
], asyncHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    throw new APIError({status: 400, title: "Missing signature"});
  }
  // Verify and process...
  return res.json({data: {received: true}});
}));
```

## Prefer modelRouter actions over custom routes

Before adding a standalone route, check if `collectionActions` or `instanceActions` on `modelRouter` fits:

- `POST /todos/bulkComplete` → `collectionActions.bulkComplete`
- `POST /todos/:id/markComplete` → `instanceActions.markComplete`

Actions are documented in OpenAPI and get SDK hooks after regeneration.

## Custom routes inside modelRouter

```typescript
modelRouter("/todos", Todo, {
  endpoints: (router) => {
    router.get("/export", [
      authenticateMiddleware(),
      createOpenApiBuilder(options)
        .withTags(["todos"])
        .withSummary("Export todos as CSV")
        .build(),
    ], asyncHandler(async (req, res) => {
      // ...
    }));
  },
  permissions: { /* ... */ },
});
```

Custom `endpoints` are registered **before** CRUD routes.

## After adding a custom route

1. Verify `/openapi.json` includes the new endpoint
2. Run `generate-sdk` in the frontend
3. Add tests with supertest
