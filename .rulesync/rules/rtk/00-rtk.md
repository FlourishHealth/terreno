---
localRoot: true
targets: ["*"]
description: "@terreno/rtk package guidelines"
globs: ["**/*"]
---

# @terreno/rtk

Redux Toolkit Query utilities for @terreno/api backends.

## Commands

```bash
bun run compile          # Compile TypeScript
bun run dev              # Watch mode
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Purpose

Provides Redux Toolkit Query integration for frontends connecting to @terreno/api backends, including:

- Authentication handling with JWT
- Secure token storage (expo-secure-store)
- Axios with retry logic
- Socket.io client integration
- RTK Query base API configuration

## Usage

Always use generated SDK hooks - never use `axios` or `request` directly:

```typescript
// Correct
import {useGetYourRouteQuery} from "@/store/openApiSdk";
const {data, isLoading, error} = useGetYourRouteQuery({id: "value"});

// Wrong - don't use axios directly
// const result = await axios.get("/api/yourRoute/value");
```

## Code Style

- Use TypeScript with ES modules
- Prefer interfaces over types
- Use Luxon for dates (not Date or dayjs)
- Use const arrow functions
- Named exports preferred
