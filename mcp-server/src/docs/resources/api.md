# @terreno/api Documentation

Django REST Framework-styled batteries-included framework for building REST APIs with Node/Express/Mongoose.

## Key Exports

- `modelRouter` - Auto-creates CRUD APIs for Mongoose models
- `Permissions` - Declarative permission system
- `APIError` - Standardized error handling (JSON:API format)
- `authenticateMiddleware` - JWT/Passport authentication
- `createOpenApiBuilder` - Fluent API for custom route documentation

## modelRouter

The core of @terreno/api. Auto-generates CRUD endpoints for Mongoose models.

```typescript
import { modelRouter, Permissions, OwnerQueryFilter } from "@terreno/api";

export const addTodoRoutes = (router: Router) => {
  router.use("/todos", modelRouter(Todo, {
    permissions: {
      create: [Permissions.IsAuthenticated],
      list: [Permissions.IsAuthenticated],
      read: [Permissions.IsOwner],
      update: [Permissions.IsOwner],
      delete: [Permissions.IsOwner],
    },
    queryFields: ["completed", "ownerId"],
    queryFilter: OwnerQueryFilter,
    sort: "-created",
    preCreate: (body, req) => ({
      ...body,
      ownerId: (req.user as UserDocument)?._id,
    }),
  }));
};
```

### Configuration Options

| Option | Description |
|--------|-------------|
| `permissions` | Object with create/list/read/update/delete permissions |
| `queryFields` | Fields allowed in query string filters |
| `sort` | Default sort order (prefix with - for descending) |
| `populatePaths` | Relations to populate in responses |
| `preCreate/preUpdate/preDelete` | Hooks run before operations |
| `postCreate/postUpdate/postDelete` | Hooks run after operations |
| `responseHandler` | Final serialization before returning to client |
| `transformer` | Data transformation rules |
| `queryFilter` | Filter applied to all queries (e.g., OwnerQueryFilter) |

## Permissions System

```typescript
import { Permissions } from "@terreno/api";

// Built-in permissions
Permissions.IsAny              // Allow any user (including anonymous)
Permissions.IsAuthenticated    // Require logged-in user
Permissions.IsAdmin            // Require admin user
Permissions.IsOwner            // Require user to own the resource
Permissions.IsAuthenticatedOrReadOnly  // Auth for writes, public reads

// Custom permission
const IsVerified = (method, user, obj) => user?.isVerified === true;
```

## APIError

```typescript
import { APIError } from "@terreno/api";

// Throw standardized errors
throw new APIError({
  status: 400,
  title: "Validation Error",
  detail: "Email is required",
  code: "VALIDATION_ERROR",
  fields: { email: "Email is required" },
});
```

## Lifecycle Hooks

```typescript
modelRouter(Model, {
  // Before operations
  preCreate: (body, req) => ({ ...body, ownerId: req.user._id }),
  preUpdate: (body, req, existingDoc) => body,
  preDelete: (req, existingDoc) => { /* validation */ },

  // After operations
  postCreate: (doc, req) => { /* send notification */ },
  postUpdate: (doc, req) => { /* audit log */ },
  postDelete: (doc, req) => { /* cleanup */ },

  // Response handling
  responseHandler: (doc, req) => transformDoc(doc),
});
```

## Transformers

```typescript
import { AdminOwnerTransformer } from "@terreno/api";

modelRouter(Model, {
  transformer: new AdminOwnerTransformer({
    adminFields: ["internalNotes", "revenue"],
    ownerFields: ["email", "settings"],
    publicFields: ["name", "avatar"],
  }),
});
```

## Mongoose Plugins

```typescript
import {
  createdUpdatedPlugin,
  isDeletedPlugin,
  isDisabledPlugin,
  baseUserPlugin,
  addDefaultPlugins
} from "@terreno/api";

// Individual plugins
schema.plugin(createdUpdatedPlugin);  // Adds created/updated timestamps
schema.plugin(isDeletedPlugin);       // Soft delete support
schema.plugin(isDisabledPlugin);      // Account disable support

// Or add all default plugins
addDefaultPlugins(schema);
```

## OpenAPI Builder

```typescript
import { createOpenApiBuilder } from "@terreno/api";

const builder = createOpenApiBuilder()
  .withTags(["Users"])
  .withSummary("Get user profile")
  .withQueryParameter("include", "string", false, "Fields to include")
  .withResponse(200, UserSchema);

router.get("/profile", builder.build(), async (req, res) => {
  // handler
});
```

## Authentication

```typescript
import { authenticateMiddleware, signupUser, generateTokens } from "@terreno/api";

// Protect routes
router.use(authenticateMiddleware);

// Sign up new user
const user = await signupUser({ email, password, name });

// Generate JWT tokens
const { token, refreshToken } = await generateTokens(user);
```

## Model Requirements

```typescript
const schema = new mongoose.Schema({
  // your fields
}, {
  strict: "throw",  // Required: throw on unknown fields
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Use these instead of findOne
Model.findExactlyOne(query);   // Throws if not exactly one result
Model.findOneOrThrow(query);   // Throws if no result
Model.findOneOrNone(query);    // Returns null if no result
```
