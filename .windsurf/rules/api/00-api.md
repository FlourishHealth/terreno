# @terreno/api

Express/Mongoose REST API framework styled after Django REST Framework. This is a **backend-only** package — no React, no UI components, no frontend code.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### File Structure

```
src/
  index.ts               # All package exports
  api.ts                 # modelRouter core (~1000 lines)
  auth.ts                # JWT/Passport authentication
  permissions.ts         # Permission system
  errors.ts              # APIError and error middleware
  expressServer.ts       # setupServer and middleware stack
  openApiBuilder.ts      # Fluent OpenAPI middleware builder
  openApi.ts             # OpenAPI spec generation
  logger.ts              # Winston-based logging
  plugins.ts             # Mongoose schema plugins
  populate.ts            # Population and OpenAPI schema generation
  transformers.ts        # Data serialization (deprecated, use hooks)
  utils.ts               # isValidObjectId, checkModelsStrict
  notifiers/             # Slack, Google Chat, Zoom integrations
  tests.ts               # Test models and helpers
  tests/bunSetup.ts      # Test environment setup
```

## modelRouter

Auto-generates RESTful CRUD APIs for Mongoose models with permissions, population, filtering, and lifecycle hooks.

### Generated Endpoints

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| Create | POST | `/` | Create document |
| List | GET | `/` | List with pagination |
| Read | GET | `/:id` | Get single document |
| Update | PATCH | `/:id` | Update document |
| Delete | DELETE | `/:id` | Delete/soft-delete |
| Array Push | POST | `/:id/:field` | Push to array field |
| Array Update | PATCH | `/:id/:field/:itemId` | Update array item |
| Array Remove | DELETE | `/:id/:field/:itemId` | Remove array item |

### All Options

```typescript
modelRouter(Model, {
  // Permissions (required) — empty array [] disables the method
  permissions: {
    create: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsOwner],
    update: [Permissions.IsOwner],
    delete: [],  // Disabled
  },

  // Query & Filtering
  queryFields: ["_id", "type", "status"],       // Allowed query params
  queryFilter: (user, query) => ({ownerId: user?.id}),  // Filter/validate queries
  defaultQueryParams: {status: "active"},        // Default constraints
  sort: "-created",                              // Default sort order
  defaultLimit: 100,                             // Default page size
  maxLimit: 500,                                 // Maximum page size
  allowAnonymous: false,                         // Allow unauthenticated access

  // Population
  populatePaths: [{path: "user", fields: ["name", "email"]}],

  // Lifecycle Hooks
  preCreate: (body, req) => ({...body, ownerId: req.user._id}),
  preUpdate: (body, req) => body,
  preDelete: (obj, req) => obj,
  postCreate: (obj, req) => {},
  postUpdate: (obj, cleanedBody, req, prevValue) => {},
  postDelete: (req, obj) => {},

  // Response Handling
  responseHandler: (value, method, req, options) => serializedValue,

  // Custom Routes (registered before CRUD)
  endpoints: (router) => { router.get("/custom", handler); },

  // OpenAPI
  openApiOverwrite: {get: {...}, list: {...}},
  openApiExtraModelProperties: {...},

  // Validation (optional) — per-route validation control
  validation: {
    validateCreate: true,     // Validate POST requests
    validateUpdate: true,     // Validate PATCH requests
    validateQuery: true,      // Validate query parameters on GET list
  },
});
```

### Query Features

- Pagination: `?limit=20&page=2` — response includes `{data, limit, more, page, total}`
- Sorting: `?sort=-created` or as object `{field: 'ascending'}`
- Field queries: `?name=test&status=active` (must be in queryFields)
- Complex queries: `?$and=[{...}]`, `?$or=[{...}]`

## OpenAPI Validation

Runtime request validation using AJV against OpenAPI schemas. Validation is always installed as middleware but inactive by default.

### Enable Validation

Call `configureOpenApiValidator()` at server startup to activate validation globally:

```typescript
import {configureOpenApiValidator, logger} from "@terreno/api";

configureOpenApiValidator({
  removeAdditional: true,  // Strip unknown properties (default: true)
  coerceTypes: true,       // Coerce types like "123" to 123 (default: true)
  onAdditionalPropertiesRemoved: (props, req) => {
    logger.warn(`Stripped: ${props.join(", ")} on ${req.method} ${req.path}`);
  },
});
```

### Per-Route Validation

Control validation per modelRouter instance:

```typescript
modelRouter(Todo, {
  permissions: {...},
  validation: {
    validateCreate: true,   // Validate POST requests
    validateUpdate: true,   // Validate PATCH requests
    validateQuery: true,    // Validate query parameters
  },
});
```

### Validation Behavior

- **Inactive by default** — validation middleware is no-op until `configureOpenApiValidator()` is called
- **Strips unknown properties** — `removeAdditional: true` removes fields not in schema
- **Type coercion** — Converts string "123" to number 123 when schema expects number
- **Query validation** — Validates query parameters on list endpoints using `buildQuerySchemaFromFields()`
- **Non-standard types** — Gracefully skips validation for models with non-standard Mongoose types (e.g., `schemaobjectid`, `dateonly`)

### Custom Routes with Validation

Use `withValidation()` in OpenAPI builder:

```typescript
router.post("/custom", [
  authenticateMiddleware(),
  createOpenApiBuilder(options)
    .withTags(["custom"])
    .withRequestBody({name: {type: "string", required: true}, age: {type: "number"}})
    .withValidation(true)  // Enable validation for this route
    .build(),
], asyncHandler(async (req, res) => {
  return res.json({data: result});
}));
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `validateRequests` | boolean | true | Enable request body validation |
| `validateResponses` | boolean | false | Enable response validation (overhead) |
| `coerceTypes` | boolean | true | Coerce types (e.g., string to number) |
| `removeAdditional` | boolean | true | Strip unknown properties |
| `onValidationError` | function | undefined | Custom error handler |
| `onAdditionalPropertiesRemoved` | function | undefined | Hook for monitoring stripped properties |

## Authentication

JWT + Passport-based auth with multiple strategies: Email/Password, GitHub OAuth, and Anonymous.

### Email/Password Authentication

Key functions:

- `setupAuth(app, userModel)` — Configures Passport (JWT, Local, Anonymous strategies)
- `addAuthRoutes(app, userModel, authOptions?)` — POST `/auth/login`, `/auth/signup`, `/auth/refresh_token`
- `addMeRoutes(app, userModel)` — GET/PATCH `/auth/me`
- `authenticateMiddleware(anonymous?)` — Returns auth middleware
- `signupUser(userModel, email, password, body?)` — Register user
- `generateTokens(user, authOptions?)` — Sign JWT tokens

Endpoints:
- `POST /auth/signup` — User registration
- `POST /auth/login` — Authenticate with email/password
- `POST /auth/refresh_token` — Refresh access token
- `GET /auth/me` — Get current user profile
- `PATCH /auth/me` — Update current user profile

### GitHub OAuth Authentication

Add GitHub OAuth login to your API:

```typescript
import {githubUserPlugin, setupServer} from "@terreno/api";

// Add GitHub fields to user schema
userSchema.plugin(githubUserPlugin);

setupServer({
  userModel: User,
  githubAuth: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL!,
  },
});
```

Key exports:
- `githubUserPlugin` — Adds GitHub fields to user schema (githubId, githubUsername, githubProfileUrl, githubAvatarUrl)
- `setupGitHubAuth(app, userModel, options)` — Configures GitHub OAuth strategy
- `addGitHubAuthRoutes(app, userModel, authOptions, githubOptions)` — Adds GitHub OAuth routes

GitHub OAuth endpoints:
- `GET /auth/github` — Initiates GitHub OAuth flow
- `GET /auth/github/callback` — GitHub OAuth callback
- `POST /auth/github/link` — Link GitHub to existing account (requires authentication)
- `DELETE /auth/github/unlink` — Unlink GitHub from account (requires authentication)

### Environment Variables

Email/Password:
- `TOKEN_SECRET` — JWT signing secret (required)
- `TOKEN_ISSUER` — JWT issuer claim (required)
- `REFRESH_TOKEN_SECRET` — Refresh token secret (required)
- `SESSION_SECRET` — Express session secret (required)
- `TOKEN_EXPIRES_IN` — Token TTL (default: 15m)
- `REFRESH_TOKEN_EXPIRES_IN` — Refresh token TTL (default: 30d)
- `SIGNUP_DISABLED` — Disable user registration

GitHub OAuth (optional):
- `GITHUB_CLIENT_ID` — GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET` — GitHub OAuth app client secret
- `GITHUB_CALLBACK_URL` — GitHub OAuth callback URL (e.g., https://yourapp.com/auth/github/callback)

## Permissions

All permission methods in the array must return true (AND logic).

| Permission | Description |
|-----------|-------------|
| `Permissions.IsAdmin` | User has `admin: true` |
| `Permissions.IsAny` | Always allows |
| `Permissions.IsAuthenticated` | Logged in, non-anonymous |
| `Permissions.IsAuthenticatedOrReadOnly` | Auth for writes, anyone for reads |
| `Permissions.IsOwner` | Admin or `obj.ownerId === user.id` |
| `Permissions.IsOwnerOrReadOnly` | Owner for writes, anyone for reads |

### OwnerQueryFilter

Restricts list queries to documents owned by the current user:

```typescript
import {OwnerQueryFilter} from "@terreno/api";
// queryFilter: OwnerQueryFilter
// Produces: {ownerId: user.id}
```

## Custom Routes with OpenAPI Builder

For non-CRUD endpoints, use the fluent builder to generate OpenAPI documentation:

```typescript
import {asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";

router.get("/stats/:id", [
  authenticateMiddleware(),
  createOpenApiBuilder(options)
    .withTags(["stats"])
    .withSummary("Get statistics")
    .withPathParameter("id", {type: "string"})
    .withQueryParameter("limit", {type: "number"}, {required: false})
    .withResponse(200, {count: {type: "number"}, items: {type: "array", items: {type: "object"}}})
    .build(),
], asyncHandler(async (req, res) => {
  return res.json({data: result});
}));
```

Builder methods: `withTags`, `withSummary`, `withDescription`, `withRequestBody`, `withResponse`, `withArrayResponse`, `withQueryParameter`, `withPathParameter`.

## Error Handling

```typescript
import {APIError} from "@terreno/api";

// Throw with status and title (required)
throw new APIError({status: 400, title: "Validation failed"});

// With field-level errors
throw new APIError({
  status: 400,
  title: "Validation failed",
  detail: "One or more fields are invalid",
  fields: {email: "Email is required", name: "Name too short"},
});

// Disable Sentry tracking
throw new APIError({status: 404, title: "Not found", disableExternalErrorTracking: true});
```

Error middleware (`apiErrorMiddleware`, `apiUnauthorizedMiddleware`) is automatically added by `setupServer`.

## Mongoose Conventions

### Plugins

| Plugin | Adds | Description |
|--------|------|-------------|
| `createdUpdatedPlugin` | `created`, `updated` | Auto-managed timestamps |
| `isDeletedPlugin` | `deleted` | Soft delete (auto-filtered from queries) |
| `isDisabledPlugin` | `disabled` | Returns 401 for disabled users |
| `baseUserPlugin` | `admin`, `email` | Base user fields |
| `findExactlyOne` | static method | Throws if 0 or multiple matches |
| `findOneOrNone` | static method | Throws if multiple matches |
| `upsertPlugin` | static method | Create or update atomically |
| `errorsPlugin` | `apiErrors` field | Store JSONAPI errors on documents |

### Critical Rules

- **Never use `Model.findOne`** — use `Model.findExactlyOne` or `Model.findOneOrThrow`
- Define methods by direct assignment: `schema.methods = {bar() {}}`
- Define statics by direct assignment: `schema.statics = {baz() {}}`
- All model types live in `src/modelInterfaces.ts` or `src/types/models/`

### Model Type Pattern

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

### User Type Casting

- In routes: `req.user` is `UserDocument | undefined`
- In @terreno/api callbacks: `const user = u as unknown as UserDocument`
- Never use `as any as UserDocument`

## setupServer

```typescript
import {setupServer} from "@terreno/api";

setupServer({
  userModel: User,
  addRoutes: (router, options) => {
    router.use("/todos", modelRouter(Todo, {...options, ...}));
  },
  corsOrigin: true,
  authOptions: {generateJWTPayload: (user) => ({sub: user._id, admin: user.admin})},
});
```

### Middleware Stack (in order)

1. CORS → 2. JSON parser → 3. Auth setup → 4. Auth routes → 5. Request logging → 6. Sentry → 7. OpenAPI ETag → 8. OpenAPI middleware → 9. Swagger UI (if enabled) → 10. User routes → 11. Error middleware

### Environment Variables

- `ENABLE_SWAGGER=true` — Enable Swagger UI at `/swagger`
- `USE_SENTRY_LOGGING=true` — Send errors to Sentry

## Logging

Use the `logger` object, never `console.log`:

```typescript
import {logger} from "@terreno/api";

logger.info("Server started", {port: 4000});
logger.warn("Slow query", {ms: 500});
logger.error("Failed to process", {error});
logger.debug("Request details", {body: req.body});
logger.catch(error);  // Logs and captures exception
```

## Testing

- Framework: bun test with expect
- HTTP testing: supertest
- Use existing manual mocks from `src/__mocks__/` (Sentry is mocked)
- **Never mock @terreno/api or models** — test against real functionality
- Test helpers: `getBaseServer()`, `authAsUser(app, "admin" | "notAdmin")`, `setupDb()`
- Field-level error assertions: `expect(res.body.fields.email).toBe("Email required")`
