# CLAUDE.md Template for Terreno Projects

Copy this file as `CLAUDE.md` to projects that use @terreno/api, @terreno/ui, and @terreno/rtk.

---

# [Project Name]

Full-stack application built with Terreno packages.

## Tech Stack

- **Backend**: Express + Mongoose using @terreno/api
- **Frontend**: React Native/Expo using @terreno/ui and @terreno/rtk
- **Database**: MongoDB

## Commands

```bash
# Backend
bun run backend:dev      # Start backend dev server
bun run backend:test     # Run backend tests

# Frontend
bun run frontend:web     # Start frontend web
bun run frontend:ios     # Start iOS simulator
bun run sdk              # Regenerate API SDK from backend
bun run frontend:test    # Run frontend tests

# Both
bun run lint             # Lint all code
bun run lint:fix         # Fix lint issues
bun run compile          # Type check
```

## Architecture

### Backend (@terreno/api)

Uses modelRouter for automatic CRUD endpoints:

```typescript
import {modelRouter, Permissions, OwnerQueryFilter, APIError, logger} from "@terreno/api";

// Example: Creating a model route
router.use(
  "/items",
  modelRouter(Item, {
    permissions: {
      create: [Permissions.IsAuthenticated],
      delete: [Permissions.IsOwner],
      list: [Permissions.IsAuthenticated],
      read: [Permissions.IsOwner],
      update: [Permissions.IsOwner],
    },
    preCreate: (body, req) => ({
      ...body,
      ownerId: req.user?._id,
    }),
    queryFields: ["status", "ownerId"],
    queryFilter: OwnerQueryFilter,
    sort: "-created",
  })
);
```

#### Backend Conventions

- **Errors**: Throw `APIError` with status and title: `throw new APIError({status: 400, title: "Invalid input"})`
- **Mongoose**: Use `Model.findExactlyOne()` or `Model.findOneOrThrow()` (not `findOne`)
- **Logging**: Use `logger.info/warn/error/debug` for permanent logs
- **User casting**: In routes use `req.user as UserDocument`

### Frontend (@terreno/rtk + @terreno/ui)

#### Store Setup

```typescript
import {generateAuthSlice} from "@terreno/rtk";
import {combineReducers, configureStore} from "@reduxjs/toolkit";
import {terrenoApi} from "./sdk";

const authSlice = generateAuthSlice(terrenoApi);

const rootReducer = combineReducers({
  auth: authSlice.authReducer,
  "terreno-rtk": terrenoApi.reducer,
});

const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat([
      ...authSlice.middleware,
      terrenoApi.middleware,
    ]),
  reducer: rootReducer,
});
```

#### Root Layout

```typescript
import {TerrenoProvider} from "@terreno/ui";
import {Provider} from "react-redux";
import store from "./store";

const App = () => (
  <Provider store={store}>
    <TerrenoProvider openAPISpecUrl={`${API_URL}/openapi.json`}>
      <RootNavigator />
    </TerrenoProvider>
  </Provider>
);
```

#### Using Generated SDK Hooks

After backend changes, regenerate SDK:
```bash
bun run sdk
```

Always use generated hooks (never raw axios/fetch):

```typescript
import {
  useGetItemsQuery,
  usePostItemsMutation,
  usePatchItemsByIdMutation,
  useDeleteItemsByIdMutation,
} from "@/store";

const ItemsScreen = () => {
  const {data, isLoading, refetch} = useGetItemsQuery({});
  const [createItem] = usePostItemsMutation();
  const [updateItem] = usePatchItemsByIdMutation();
  const [deleteItem] = useDeleteItemsByIdMutation();

  const handleCreate = async () => {
    await createItem({body: {title: "New Item"}}).unwrap();
  };

  const handleUpdate = async (id: string) => {
    await updateItem({id, body: {status: "done"}}).unwrap();
  };
};
```

#### UI Components

```typescript
import {
  Box,
  Button,
  Card,
  CheckBox,
  Heading,
  IconButton,
  Page,
  Spinner,
  Text,
  TextField,
} from "@terreno/ui";

const MyComponent = () => (
  <Page navigation={undefined}>
    <Box padding={4} gap={3}>
      <Heading size="xl">Title</Heading>
      <Card>
        <Box direction="row" alignItems="center" gap={2}>
          <CheckBox selected={isSelected} />
          <Text>Item text</Text>
          <IconButton iconName="trash" variant="destructive" onClick={handleDelete} />
        </Box>
      </Card>
      <Button text="Submit" onClick={handleSubmit} loading={isLoading} />
    </Box>
  </Page>
);
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
- Never mock @terreno packages directly

### Logging
- Frontend: Use `console.info`, `console.debug`, `console.warn`, or `console.error` for permanent logs
- Backend: Use `logger.info/warn/error/debug` for permanent logs
- Use `console.log` only for debugging (to be removed)

### React Best Practices
- Use functional components with `React.FC` type
- Import hooks directly: `import {useEffect, useMemo} from 'react'`
- Always provide return types for functions
- Add explanatory comment above each `useEffect`
- Wrap callbacks in `useCallback`
- Use Redux Toolkit for state management
- Always support React-Native Web

### Development Practices
- Don't apologize for errors: fix them
- Prioritize modularity, DRY, performance, and security
- Focus on readability over performance
- Write complete, functional code without TODOs when possible
- Comments should describe purpose, not effect

## Workflow

### Adding a New Feature

1. **Backend**: Create Mongoose model in `models/`
2. **Backend**: Add route using `modelRouter` in `api/`
3. **Backend**: Register route in server setup
4. **Frontend**: Run `bun run sdk` to regenerate hooks
5. **Frontend**: Build UI using generated hooks and @terreno/ui components

### Common Permissions Patterns

```typescript
// Public read, authenticated write
permissions: {
  create: [Permissions.IsAuthenticated],
  delete: [Permissions.IsAuthenticated],
  list: [],  // Public
  read: [],  // Public
  update: [Permissions.IsAuthenticated],
}

// Owner-only access
permissions: {
  create: [Permissions.IsAuthenticated],
  delete: [Permissions.IsOwner],
  list: [Permissions.IsAuthenticated],
  read: [Permissions.IsOwner],
  update: [Permissions.IsOwner],
}
queryFilter: OwnerQueryFilter,

// Admin-only
permissions: {
  create: [Permissions.IsAdmin],
  delete: [Permissions.IsAdmin],
  list: [Permissions.IsAdmin],
  read: [Permissions.IsAdmin],
  update: [Permissions.IsAdmin],
}
```

## Reference

- **@terreno/api docs**: See backend-example in Terreno repo
- **@terreno/ui components**: See demo app in Terreno repo
- **@terreno/rtk integration**: See frontend-example in Terreno repo
