---
localRoot: true
targets: ["*"]
description: "@terreno/api package guidelines"
globs: ["**/*"]
---

# @terreno/api

REST API framework built on Express/Mongoose, styled after Django REST Framework.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### modelRouter

Automatically creates RESTful CRUD APIs for Mongoose models with built-in permissions, population, filtering, and lifecycle hooks.

```typescript
import {modelRouter, modelRouterOptions, Permissions} from "@terreno/api";

const router = modelRouter(YourModel, {
  permissions: {
    list: [Permissions.IsAuthenticated],
    create: [Permissions.IsAuthenticated],
    read: [Permissions.IsOwner],
    update: [Permissions.IsOwner],
    delete: [],  // Disabled
  },
  sort: "-created",
  queryFields: ["_id", "type", "name"],
});
```

### Custom Routes

For non-CRUD endpoints, use the OpenAPI builder:

```typescript
import {asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";

router.get("/yourRoute/:id", [
  authenticateMiddleware(),
  createOpenApiBuilder(options)
    .withTags(["yourTag"])
    .withSummary("Brief summary")
    .withPathParameter("id", {type: "string"})
    .withResponse(200, {data: {type: "object"}})
    .build(),
], asyncHandler(async (req, res) => {
  return res.json({data: result});
}));
```

## Conventions

### Error Handling
- Throw `APIError` with appropriate status codes: `throw new APIError({status: 400, title: "Message"})`
- Services should throw user-friendly errors

### Mongoose
- Do not use `Model.findOne` - use `Model.findExactlyOne` or `Model.findOneOrThrow`
- Define statics/methods by direct assignment: `schema.methods = {bar() {}}`
- All model types live in `src/modelInterfaces.ts`

### User Type Casting
- In API routes: `req.user` is `UserDocument | undefined`
- In @terreno/api callbacks: cast with `const user = u as unknown as UserDocument`
- Never use `as any as UserDocument`

### Logging
- Use `logger.info/warn/error/debug` for permanent logs (not `console.log`)

### Testing
- Use bun test with expect for testing
- Use existing manual mocks from `src/__mocks__/`
- Never mock @terreno/api or models

## Model Type Generation

When creating/modifying Mongoose models, update `src/modelInterfaces.ts`:

```typescript
export type YourModelMethods = {
  customMethod: (this: YourModelDocument, param: string) => Promise<void>;
};

export type YourModelStatics = DefaultStatics<YourModelDocument> & {
  customStatic: (this: YourModelModel, param: string) => Promise<YourModelDocument>;
};

export type YourModelModel = DefaultModel<YourModelDocument> & YourModelStatics;
export type YourModelSchema = mongoose.Schema<YourModelDocument, YourModelModel, YourModelMethods>;
export type YourModelDocument = DefaultDoc & YourModelMethods & {
  fieldName: string;
};
```

## SDK Generation

After modifying routes, regenerate the SDK:

```bash
bun run sdk
```
