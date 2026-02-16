# @terreno/api

REST API framework built on Express and Mongoose. Provides modelRouter (CRUD endpoints), JWT auth, permissions, and OpenAPI generation.

## Key exports

- `modelRouter`, `setupServer`, `Permissions`, `OwnerQueryFilter`
- `APIError`, `logger`, `asyncHandler`, `authenticateMiddleware`
- `createOpenApiBuilder`

## Model Schema Conventions

### Required field descriptions

**Every field in a Mongoose schema must include a `description` property.** Descriptions are extracted by `mongoose-to-swagger` and included in the generated OpenAPI specification, making your API documentation and auto-generated SDK significantly more useful.

``````typescript
const schema = new mongoose.Schema<Document, Model>({
  title: {
    description: "The title of the item",
    type: String,
    required: true,
  },
  status: {
    description: "Current processing status",
    type: String,
    enum: ["pending", "active", "completed"],
    default: "pending",
  },
  ownerId: {
    description: "The user who owns this item",
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});
``````

### Writing good descriptions

- Keep them concise (one sentence is usually enough)
- Explain the field's purpose, not its type
- Use active voice: "The user who owns..." not "Owner of..."
- Include important constraints: "Email address (must be unique)"

### Benefits

Field descriptions appear in:
- OpenAPI spec at `/openapi.json`
- Generated SDK type definitions
- API documentation (Swagger UI if enabled)
- IDE autocomplete hints when using the SDK

## Learn more

- [How to create a model](../how-to/create-a-model.md)
- [API package source](../../api/src/)
- [AI assistant rules](./.cursor/rules/api/)
