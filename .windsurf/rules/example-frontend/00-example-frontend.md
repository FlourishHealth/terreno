# example-frontend

Example Expo app demonstrating full-stack usage with @terreno/api backend, @terreno/rtk for state, and @terreno/ui for components. This is a **frontend-only** app — no Express, no Mongoose, no backend code.

## Commands

```bash
bun run start            # Start Expo dev server (port 8082)
bun run web              # Start web version
bun run ios              # Start iOS simulator
bun run android          # Start Android emulator
bun run sdk              # Generate API SDK from backend OpenAPI spec
bun run test             # Run tests
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Architecture

### File Structure

```
app/
  _layout.tsx            # Root layout: Redux Provider, TerrenoProvider, auth routing
  login.tsx              # Login screen
  (tabs)/
    _layout.tsx          # Tab navigation (Todos, Profile)
    index.tsx            # Todos list screen
    profile.tsx          # User profile screen
store/
  index.ts               # Redux store: authReducer + appState + API middleware
  appState.ts            # App-level state (darkMode, language)
  openApiSdk.ts          # Generated RTK Query hooks (DO NOT EDIT MANUALLY)
  sdk.ts                 # SDK exports with custom endpoints and cache tags
  errors.ts              # RTK error middleware with Sentry
components/
  useColorScheme.ts      # Dark mode detection
openapi-config.ts        # SDK code generation configuration
```

### Key Integration Points

1. **Root layout** (`app/_layout.tsx`): Wraps app in Redux Provider + PersistGate + TerrenoProvider. Handles conditional routing based on auth state.
2. **Redux store** (`store/index.ts`): Uses `generateAuthSlice(api)` from @terreno/rtk. Combines auth, app state, and RTK Query reducers. Includes redux-persist with blacklists.
3. **SDK** (`store/openApiSdk.ts`): Auto-generated hooks from backend OpenAPI spec. Enhanced in `sdk.ts` with custom endpoints (getMe, patchMe) and cache tags.

## Redux Store Setup

```typescript
import {generateAuthSlice} from "@terreno/rtk";
import {openapi} from "./openApiSdk";

const {authReducer, logout, middleware} = generateAuthSlice(openapi);

const store = configureStore({
  reducer: {
    auth: authReducer,
    appState: appStateReducer,
    [openapi.reducerPath]: openapi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(openapi.middleware, ...middleware, errorMiddleware),
});
```

### Persist Configuration

- Uses redux-persist with AsyncStorage
- Blacklisted slices: tracking, terreno-rtk, profiles
- SSR-safe storage wrapper (checks `typeof window`)

## SDK Generation

After backend route changes, regenerate:

```bash
# Backend must be running on port 4000
bun run sdk
```

**Never modify `openApiSdk.ts` manually.** Customize in `sdk.ts`:

```typescript
export const terrenoApi = openapi
  .injectEndpoints({endpoints: (build) => ({
    getMe: build.query({query: () => "/auth/me", providesTags: ["profile"]}),
  })})
  .enhanceEndpoints({addTagTypes: ["todos", "users", "profile"]});
```

## API Usage Patterns

Always use generated hooks — never use axios/fetch directly:

```typescript
import {useGetTodosQuery, usePostTodosMutation} from "@/store/openApiSdk";

const {data, isLoading, error, refetch} = useGetTodosQuery({completed: false});
const [createTodo, {isLoading: isCreating}] = usePostTodosMutation();

// Create with error handling
const handleCreate = useCallback(async () => {
  try {
    await createTodo({title, completed: false}).unwrap();
  } catch (err) {
    console.error("Failed to create todo", err);
  }
}, [createTodo, title]);
```

## Authentication Flow

1. App loads → PersistGate rehydrates Redux state
2. If no userId in auth state → navigate to login screen
3. Login screen calls `useEmailLoginMutation` → tokens stored automatically
4. On success → `setUserId` dispatched → app navigates to tabs
5. Logout dispatches `logout` action → tokens cleared → back to login

## Expo Router Navigation

- File-based routing in `app/` directory
- `(tabs)/` group for bottom tab navigation
- Conditional routing based on auth state in root `_layout.tsx`
- Tab icons use FontAwesome via `@expo/vector-icons`

## Conventions

- Use @terreno/ui components (Box, Text, Button, Card) — never raw View/Text
- Use generated SDK hooks for all API calls
- Use `useCallback` for all event handlers
- Use `useState` for local form state, Redux for app-wide state
- Handle loading, error, and empty states in all screens
- Use `console.info/debug/warn/error` for permanent logs
- Use Luxon for date operations
- Always support React Native Web
