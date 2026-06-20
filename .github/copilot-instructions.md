# Terreno

A monorepo containing shared packages for building full-stack applications with React Native and Express/Mongoose.

## Packages

- **api/** - REST API framework built on Express/Mongoose (`@terreno/api`)
- **ui/** - React Native UI component library (`@terreno/ui`)
- **rtk/** - Redux Toolkit Query utilities for API backends (`@terreno/rtk`)
- **admin-backend/** - Admin panel backend plugin for @terreno/api (`@terreno/admin-backend`)
- **admin-frontend/** - Admin panel frontend screens for @terreno/api backends (`@terreno/admin-frontend`)
- **admin-spa/** - Standalone admin SPA (Expo Router web app) + Express plugin to serve it from a backend (`@terreno/admin-spa`)
- **mcp-server/** - MCP server for AI assistant integration (`@terreno/mcp`, bins `terreno-mcp` + `terreno-mcp-local`)
- **demo/** - Demo app for showcasing and testing UI components
- **example-frontend/** - Example Expo app demonstrating full stack usage
- **example-backend/** - Example Express backend using @terreno/api

## Development

Uses [Bun](https://bun.sh/) as the package manager.

```bash
bun run bootstrap        # Install dependencies + compile all packages (dev-ready setup)
bun run bootstrap:update # Reinstall + recompile after pulling changes or switching branches
bun install              # Install dependencies
bun run compile          # Compile all packages
bun run lint             # Lint all packages
bun run lint:fix         # Fix lint issues
bun run test             # Run tests in api and ui
```

- **`bootstrap`**: Run when first cloning the repo or creating a new dev environment. Installs all dependencies and compiles every package so the workspace is ready for development.
- **`bootstrap:update`**: Run when resuming work after pulling changes, switching branches, or when dependencies have changed.

### Package-specific commands

```bash
bun run api:test         # Test API package
bun run ui:test          # Test UI package
bun run demo:start       # Start demo app
bun run frontend:web     # Start frontend example
bun run backend:dev      # Start backend example
bun run mcp:build        # Build MCP server
bun run mcp:start        # Start MCP server
bun run admin-backend:compile   # Compile admin backend
bun run admin-frontend:compile  # Compile admin frontend
```

## How the Packages Work Together

The three core packages form a complete full-stack framework:

```
                           BACKEND
  @terreno/api
  - Mongoose models with modelRouter -> CRUD endpoints
  - Built-in auth (JWT + Passport)
  - Automatic OpenAPI spec generation
                              |
                     /openapi.json
                              |
                    RTK Query SDK Codegen
                              |
                           FRONTEND
  @terreno/rtk
  - Generated hooks from OpenAPI spec
  - Auth slice with JWT token management
  - Automatic token refresh
                              +
  @terreno/ui
  - React Native components (Box, Button, TextField, etc.)
  - TerrenoProvider for theming
```

### Integration Flow

1. **Backend (api)**: Define Mongoose models, use `modelRouter` to create CRUD endpoints with permissions
2. **OpenAPI Generation**: `setupServer` automatically generates `/openapi.json`
3. **SDK Codegen**: Frontend runs `bun run sdk` to generate RTK Query hooks from OpenAPI spec
4. **Frontend (rtk + ui)**: Use generated hooks with UI components for type-safe API calls

## Example Apps (Keep These Updated!)

The `example-frontend/` and `example-backend/` directories serve as both documentation and integration tests. When adding features to api, ui, or rtk:

1. **Add examples** demonstrating new features
2. **Update SDK** after backend changes: `cd example-frontend && bun run sdk`
3. **Verify integration** by running both examples together

### Running the Full Stack

```bash
# Terminal 1: Start backend
bun run backend:dev

# Terminal 2: Start frontend
bun run frontend:web
```

## Code Style

### TypeScript/JavaScript
- Use ES module syntax and TypeScript for all code
- Prefer interfaces over types; avoid enums, use maps
- Prefer const arrow functions over `function` keyword
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`)
- Use camelCase directories (e.g., `components/authWizard`)
- Favor named exports
- Use the RORO pattern (Receive an Object, Return an Object)

### Dates and Time
- Always use Luxon instead of Date or dayjs

### Error Handling
- Check error conditions at start of functions and return early
- Limit nested if statements
- Use multiline syntax with curly braces for all conditionals

### Testing
- Use bun test with expect for testing

### Logging
- Frontend: Use `console.info`, `console.debug`, `console.warn`, or `console.error` for permanent logs
- Backend: Use `logger.info/warn/error/debug` for permanent logs
- Use `console.log` only for debugging (to be removed)

### Development Practices
- Don't apologize for errors: fix them
- Prioritize modularity, DRY, performance, and security
- Focus on readability over performance
- Write complete, functional code without TODOs when possible
- Comments should describe purpose, not effect

## Package Reference

### @terreno/api

REST API framework providing:

- **modelRouter**: Auto-generates CRUD endpoints for Mongoose models
- **Permissions**: `IsAuthenticated`, `IsOwner`, `IsAdmin`, `IsAuthenticatedOrReadOnly`
- **Query Filters**: `OwnerQueryFilter` for filtering list queries by owner
- **setupServer**: Express server setup with auth, OpenAPI, and middleware
- **APIError**: Standardized error handling
- **logger**: Winston-based logging

Key imports:
```typescript
import {
  modelRouter,
  setupServer,
  Permissions,
  OwnerQueryFilter,
  APIError,
  logger,
  asyncHandler,
  authenticateMiddleware,
} from "@terreno/api";
```

#### modelRouter Usage

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

#### Custom Routes

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

#### API Conventions

- Throw `APIError` with appropriate status codes: `throw new APIError({status: 400, title: "Message"})`
- Do not use `Model.findOne` - use `Model.findExactlyOne` or `Model.findOneOrThrow`
- Define statics/methods by direct assignment: `schema.methods = {bar() {}}`
- All model types live in `src/modelInterfaces.ts`
- In routes: `req.user` is `UserDocument | undefined`
- In @terreno/api callbacks: cast with `const user = u as unknown as UserDocument`

### @terreno/ui

React Native component library with 88+ components:

- **Layout**: Box, Page, SplitPage, Card
- **Forms**: TextField, SelectField, DateTimeField, CheckBox
- **Display**: Text, Heading, Badge, DataTable
- **Actions**: Button, IconButton, Link
- **Feedback**: Spinner, Modal, Toast
- **Theming**: TerrenoProvider, useTheme

Key imports:
```typescript
import {
  Box,
  Button,
  Card,
  Page,
  Text,
  TextField,
  TerrenoProvider,
} from "@terreno/ui";
```

#### UI Component Examples

Layout with Box:
```typescript
<Box direction="row" padding={4} gap={2} alignItems="center">
  <Text>Content</Text>
  <Button text="Action" />
</Box>
```

Buttons:
```typescript
<Button
  text="Submit"
  variant="primary"  // 'primary' | 'secondary' | 'outline' | 'ghost'
  onClick={handleSubmit}
  loading={isLoading}
  iconName="check"
/>
```

Forms:
```typescript
<TextField
  label="Email"
  value={email}
  onChangeText={setEmail}
  error={emailError}
  helperText="Enter a valid email"
/>
```

Modals:
```typescript
<Modal
  title="Confirm Action"
  visible={isVisible}
  primaryButtonText="Confirm"
  secondaryButtonText="Cancel"
  onDismiss={() => setIsVisible(false)}
  onPrimaryAction={handleConfirm}
>
  <Text>Are you sure?</Text>
</Modal>
```

#### UI Common Pitfalls

- Don't use inline styles when theme values are available
- Don't use raw `View`/`Text` when `Box`/@terreno/ui `Text` are available
- Don't forget loading and error states
- Don't use `style` prop when equivalent props exist (`padding`, `margin`)
- Never modify `openApiSdk.ts` manually

### @terreno/rtk

Redux Toolkit Query integration:

- **generateAuthSlice**: Creates auth reducer and middleware with JWT handling
- **emptyApi**: Base RTK Query API for code generation
- **Platform utilities**: Secure token storage (expo-secure-store for native, AsyncStorage for web)

Key imports:
```typescript
import {generateAuthSlice} from "@terreno/rtk";
```

Always use generated SDK hooks - never use `axios` or `request` directly:

```typescript
// Correct
import {useGetYourRouteQuery} from "@/store/openApiSdk";
const {data, isLoading, error} = useGetYourRouteQuery({id: "value"});

// Wrong - don't use axios directly
// const result = await axios.get("/api/yourRoute/value");
```

## React Best Practices (Frontend Packages)

- Use functional components with `React.FC` type
- Import hooks directly: `import {useEffect, useMemo} from 'react'`
- Always provide return types for functions
- Add explanatory comment above each `useEffect`
- Wrap callbacks in `useCallback`
- Prefer const arrow functions
- Use inline styles over `StyleSheet.create`
- Use Luxon for date operations
- Place static content and interfaces at beginning of file
- Minimize `use client`, `useEffect`, and `setState`
- Always support React-Native Web

## CI/CD Workflows

### Required Secret Validation

GitHub Actions workflows that use secrets or environment variables must validate all required variables are set before using them. Add a validation step early in the job that fails fast with a clear error message listing any missing variables.

```yaml
- name: Validate required secrets
  run: |
    missing=()
    if [ -z "$VAR_NAME" ]; then missing+=("VAR_NAME"); fi
    if [ ${#missing[@]} -ne 0 ]; then
      echo "::error::Missing required secrets: ${missing[*]}"
      exit 1
    fi
```

## Dependency Management

Uses [Bun Catalogs](https://bun.sh/docs/install/catalogs) - shared versions defined in root `package.json` under `catalog`. Reference with `catalog:` in workspace packages.

## Cursor Cloud specific instructions

### Bootstrap

From the repo root after clone or when dependencies change:

```bash
bun bootstrap
```

Installs workspace dependencies and compiles all packages (`bun install && bun run compile`).

### Cloud VM toolchain

Shared install script (in **flourish** repo): `bash /agent/repos/flourish/scripts/install-cloud-dev-tools.sh` then `source ~/.cloud-dev-tools.env`. Provides **terraform**, **gcloud**, **gh**, **Playwright** (after `bun bootstrap` in packages with `@playwright/test`), **Appium**, and **Android emulator** helpers. Terreno/terraform details: `terraform/README.md`.

### Example full stack

| Service | Port | Start command |
|---------|------|---------------|
| example-backend | 4000 | `bun run backend:dev` (from repo root) |
| example-frontend web | 8082 | `bun run frontend:web` |

`example-frontend` uses in-memory Mongo via `example-backend` — no system MongoDB required for the example apps.

### Tests and lint

- `bun run lint`, `bun run api:test`, `bun run ui:test` (root `bun run test` may fail if optional workspace packages lack tests).
- `demo:start` serves the UI component demo on port **8085**.

### Gotchas

- **Port 8082** is shared by `example-frontend` and the separate **gitsight** app in this workspace — run only one web UI on 8082 at a time.
- Use `$HOME/.bun/bin/bun` if `bun` is not on `PATH` in non-interactive shells (install via https://bun.sh).
