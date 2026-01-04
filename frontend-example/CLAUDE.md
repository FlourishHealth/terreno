# @terreno/frontend-example

Example Expo app demonstrating full-stack usage with @terreno/api backend.

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

- Uses Expo Router for navigation
- Redux Toolkit for state management
- @terreno/rtk for API integration
- @terreno/ui for UI components

## SDK Generation

After backend route changes, regenerate the SDK:

```bash
bun run sdk
```

Never modify `openApiSdk.ts` manually.

## API Usage

Always use generated SDK hooks:

```typescript
import {useGetUsersQuery, useCreateUserMutation} from "@/store/openApiSdk";

const {data, isLoading, error} = useGetUsersQuery();
const [createUser] = useCreateUserMutation();
```

## React Best Practices

- Use functional components with `React.FC` type
- Import hooks directly: `import {useEffect, useMemo} from 'react'`
- Always provide return types for functions
- Add explanatory comment above each `useEffect`
- Wrap callbacks in `useCallback`
- Use Redux Toolkit for state management
- Use `createAsyncThunk` for async actions
- Use selectors for accessing state
- Always support React-Native Web

## Code Style

- Use TypeScript with ES modules
- Use Luxon for dates (not Date or dayjs)
- Prefer const arrow functions
- Named exports preferred
- Use `console.info/debug/warn/error` for permanent logs
