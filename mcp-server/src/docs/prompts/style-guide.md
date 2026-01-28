# Terreno Code Style Guide

## TypeScript/JavaScript

### General
- Use ES module syntax and TypeScript for all code
- Prefer interfaces over types; avoid enums, use maps
- Prefer const arrow functions over `function` keyword
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Use camelCase directories (e.g., `components/authWizard`)
- Favor named exports over default exports
- Use the RORO pattern (Receive an Object, Return an Object)

### Functions
```typescript
// Good
const processUser = ({ id, name }: ProcessUserArgs): ProcessUserResult => {
  // ...
};

// Avoid
function processUser(id: string, name: string) {
  // ...
}
```

### Dates and Time
- Always use Luxon instead of Date or dayjs
```typescript
import { DateTime } from "luxon";

const now = DateTime.now();
const formatted = now.toFormat("yyyy-MM-dd");
```

### Error Handling
- Check error conditions at start of functions and return early
- Limit nested if statements
- Use multiline syntax with curly braces for all conditionals

```typescript
// Good
const validateUser = (user: User): ValidationResult => {
  if (!user.email) {
    return { valid: false, error: "Email required" };
  }

  if (!user.name) {
    return { valid: false, error: "Name required" };
  }

  return { valid: true };
};

// Avoid
const validateUser = (user: User) => {
  if (user.email) {
    if (user.name) {
      return { valid: true };
    } else {
      return { valid: false, error: "Name required" };
    }
  } else {
    return { valid: false, error: "Email required" };
  }
};
```

## React Components

### Component Structure
```typescript
import React, { useCallback, useState } from "react";
import { Box, Text } from "@terreno/ui";

interface MyComponentProps {
  title: string;
  onPress?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onPress }) => {
  const [isActive, setIsActive] = useState(false);

  const handlePress = useCallback(() => {
    setIsActive(true);
    onPress?.();
  }, [onPress]);

  return (
    <Box padding={4}>
      <Text>{title}</Text>
    </Box>
  );
};
```

### Hooks
- Direct hook imports: `import { useEffect, useMemo } from 'react'`
- Wrap callbacks with `useCallback`
- Use `useMemo` for expensive computations
- Always provide explicit return types

## Logging

### Frontend
```typescript
// Permanent logs
console.info("User logged in", { userId });
console.debug("Fetching data", { params });
console.warn("Deprecated feature used");
console.error("Failed to load", { error });

// Debugging only (remove before commit)
console.log("temporary debug");
```

### Backend
```typescript
import { logger } from "@terreno/api";

logger.info("Request received", { path, method });
logger.debug("Processing data", { data });
logger.warn("Rate limit approaching", { remaining });
logger.error("Database error", { error });
```

## Testing

- Use bun test with expect
- Never mock @terreno/api or models
- Use manual mocks in `__mocks__/` directory

```typescript
import { expect, test, describe } from "bun:test";

describe("MyFeature", () => {
  test("should do something", () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

## Comments

- Comments should describe purpose, not effect
- Don't add comments to obvious code
- Use JSDoc for public APIs

```typescript
// Good - explains why
// Skip validation for admin users to allow bulk imports
if (user.admin) {
  return true;
}

// Avoid - describes what (obvious from code)
// Check if user is admin
if (user.admin) {
  return true;
}
```
