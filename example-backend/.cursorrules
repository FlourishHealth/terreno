# example-backend

Example Express backend using @terreno/api.

## Commands

```bash
bun run dev              # Start dev server with watch (port 4000)
bun run start            # Start production server
bun run compile          # Type check
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

Express server using @terreno/api with:
- Mongoose for MongoDB
- Passport for authentication
- Socket.io for real-time features
- OpenTelemetry for tracing
- Sentry for error tracking

## Creating Model Routes

Use modelRouter for CRUD APIs:

```typescript
import {modelRouter, modelRouterOptions, Permissions} from "@terreno/api";
import {Todo} from "../models";
import {TodoDocument, UserDocument} from "../types";

export const addTodoRoutes = (
  router: any,
  options?: Partial<modelRouterOptions<TodoDocument>>
): void => {
  router.use(
    "/todos",
    modelRouter(Todo, {
      ...options,
      permissions: {
        create: [Permissions.IsAuthenticated],
        delete: [Permissions.IsOwner],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsOwner],
        update: [Permissions.IsOwner],
      },
      preCreate: (body, req) => {
        return {
          ...body,
          ownerId: (req.user as UserDocument)?._id,
        } as TodoDocument;
      },
      queryFields: ["completed", "ownerId"],
      sort: "-created",
    })
  );
};
```

## Creating Custom Routes

For non-CRUD endpoints:

```typescript
import {asyncHandler, authenticateMiddleware, APIError, createOpenApiBuilder} from "@terreno/api";

router.post("/custom/:id", [
  authenticateMiddleware(),
  createOpenApiBuilder(options).withSummary("Custom route").build(),
], asyncHandler(async (req, res) => {
  const user = req.user as UserDocument;

  if (!req.params.id) {
    throw new APIError({status: 400, title: "Missing id"});
  }

  return res.json({data: result});
}));
```

## Conventions

### Error Handling
- Throw `APIError` with status and title
- Check error conditions early and return

### Mongoose
- Use `Model.findExactlyOne` or `Model.findOneOrThrow` (not `Model.findOne`)
- Define methods: `schema.methods = {}`
- Define statics: `schema.statics = {}`

### User Type Casting
- In routes: `req.user` is `UserDocument | undefined`
- In @terreno/api callbacks: `const user = u as unknown as UserDocument`

### Logging
- Use `logger.info/warn/error/debug` for permanent logs

### Testing
- Use bun test with expect for testing
- Use existing manual mocks from `__mocks__/`
- Never mock @terreno/api or models

## Code Style

- Use TypeScript with ES modules
- Use Luxon for dates (not Date or dayjs)
- Prefer const arrow functions
- Named exports preferred
