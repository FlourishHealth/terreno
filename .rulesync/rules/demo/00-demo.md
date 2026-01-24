---
localRoot: true
targets: ["*"]
description: "terreno-demo package guidelines"
globs: ["**/*"]
---

# terreno-demo

Demo app for showcasing and testing @terreno/ui components.

## Commands

```bash
bun run start            # Start Expo dev server (port 8085)
bun run web              # Start web version
bun run ios              # Start iOS simulator
bun run android          # Start Android emulator
bun run compile          # Type check
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Purpose

Interactive demo application for developing and testing UI components from @terreno/ui. Uses Expo Router for navigation.

## React Best Practices

- Use functional components with `React.FC` type
- Import hooks directly: `import {useEffect, useMemo} from 'react'`
- Always provide return types for functions
- Add explanatory comment above each `useEffect`
- Wrap callbacks in `useCallback`
- Use inline styles over `StyleSheet.create`
- Use Luxon for date operations
- Always support React-Native Web

## Component Usage

Use @terreno/ui components:

```typescript
import {Box, Text, Button} from '@terreno/ui';

<Box padding={4} gap={2}>
  <Text size="lg">Demo Component</Text>
  <Button text="Click me" onClick={handleClick} />
</Box>
```

## Code Style

- Use TypeScript with ES modules
- Use Luxon for dates (not Date or dayjs)
- Prefer const arrow functions
- Named exports preferred
- Use `console.info/debug/warn/error` for permanent logs
