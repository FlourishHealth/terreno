---
root: true
targets: ["cursor", "windsurf", "copilot"]
description: "Terreno monorepo root guidelines"
globs: ["**/*"]
---

# Terreno

A monorepo containing shared packages for building full-stack applications with React Native and Express/Mongoose.

## Packages

- **api/** - REST API framework built on Express/Mongoose (`@terreno/api`)
- **ui/** - React Native UI component library (`@terreno/ui`)
- **rtk/** - Redux Toolkit Query utilities for API backends (`@terreno/rtk`)
- **mcp-server/** - MCP server for AI assistant integration (`@terreno/mcp-server`)
- **demo/** - Demo app for showcasing and testing UI components
- **example-frontend/** - Example Expo app demonstrating full stack usage
- **example-backend/** - Example Express backend using @terreno/api

## Development

Uses [Bun](https://bun.sh/) as the package manager.

```bash
bun install              # Install dependencies
bun run compile          # Compile all packages
bun run lint             # Lint all packages
bun run lint:fix         # Fix lint issues
bun run test             # Run tests in api and ui
bun run rules            # Generate rules from .rulesync/rules/ sources
bun run rules:check      # Verify rules are in sync (CI check)
```

### Package-specific commands

```bash
# API package
bun run api:compile      # Compile TypeScript
bun run api:lint         # Lint code
bun run api:test         # Run tests

# UI package
bun run ui:compile       # Compile TypeScript
bun run ui:dev           # Watch mode
bun run ui:lint          # Lint code
bun run ui:test          # Run tests

# RTK package
bun run rtk:compile      # Compile TypeScript
bun run rtk:dev          # Watch mode
bun run rtk:lint         # Lint code
bun run rtk:test         # Run tests

# Demo app
bun run demo:start       # Start Expo dev server (port 8085)
bun run demo:web         # Start web version
bun run demo:ios         # Start iOS simulator
bun run demo:android     # Start Android emulator
bun run demo:compile     # Type check
bun run demo:lint        # Lint code

# Example frontend
bun run frontend:web     # Start web version
bun run frontend:ios     # Start iOS simulator
bun run frontend:android # Start Android emulator
bun run frontend:lint    # Lint code

# Example backend
bun run backend:dev      # Start dev server with watch (port 4000)
bun run backend:lint     # Lint code

# MCP server
bun run mcp:build        # Build the server
bun run mcp:dev          # Development mode
bun run mcp:start        # Start the server
bun run mcp:lint         # Lint code
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
