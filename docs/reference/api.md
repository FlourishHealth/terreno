# @terreno/api

REST API framework built on Express and Mongoose. Provides modelRouter (CRUD endpoints), JWT auth, permissions, and OpenAPI generation.

## Key exports

- `modelRouter`, `setupServer`, `Permissions`, `OwnerQueryFilter`
- `APIError`, `logger`, `asyncHandler`, `authenticateMiddleware`
- `createOpenApiBuilder`

## Conventions

- Every Mongoose schema field must include a `description` property (flows to OpenAPI spec)
- Use `Model.findExactlyOne` or `Model.findOneOrThrow` instead of `Model.findOne`
- Define methods/statics by direct assignment: `schema.methods = {...}`

## Documentation

See the [api package source](../../api/src/) and [.cursor/rules/api/](../../.cursor/rules/api/) for detailed usage and conventions.
