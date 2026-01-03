# Testing

This directory contains test setup and helper utilities for the backend.

## Files

- **`setup.ts`** - Global test setup that runs before all tests
  - Connects to test database
  - Cleans up database after each test
  - Disconnects and drops database after all tests

- **`helpers.ts`** - Test utility functions
  - `createTestUser()` - Create a test user with default or custom data
  - `generateTestEmail()` - Generate a unique email for testing
  - `cleanupTestData()` - Clean up all test data

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

## Test Configuration

Test configuration is in `bunfig.toml`:
- Setup file is automatically preloaded before tests
- Coverage is enabled by default
- Coverage threshold is set to 70%

## Writing Tests

### Test File Naming
Test files should be named `*.test.ts` and placed next to the file they're testing.

### Example Test

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { User } from "./User";
import { createTestUser, generateTestEmail } from "../test/helpers";

describe("User Model", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it("should create a user", async () => {
    const email = generateTestEmail();
    const user = await User.create({
      email,
      name: "Test User",
    });

    expect(user._id).toBeDefined();
    expect(user.email).toBe(email);
  });
});
```

### Using Bun Test Assertions

We use Bun's built-in `expect` assertions:

```typescript
import { expect } from "bun:test";

// Equality
expect(actual).toBe(expected);           // Strict equality (===)
expect(actual).toEqual(expected);         // Deep equality

// Existence
expect(value).toBeDefined();              // Not undefined
expect(value).toBeNull();                 // Is null
expect(value).toBeTruthy();              // Truthy value

// Strings
expect(string).toContain(substring);      // Contains substring

// Numbers
expect(number).toBeGreaterThan(value);    // > value
expect(number).toBeLessThan(value);       // < value
```

### Testing APIErrors

When testing services that throw APIError, check for properties:

```typescript
try {
  await userService.createUser("", "");
  throw new Error("Should have thrown error");
} catch (error: unknown) {
  const err = error as {status?: number; title?: string};
  expect(err.status).toBeDefined();
  expect(err.title).toBeDefined();
  expect(err.status).toBe(400);
  expect(err.title?.toLowerCase() ?? "").toContain("required");
}
```

## Test Database

The test database is separate from development:
- Default: `mongodb://localhost:27017/terreno-example-test`
- Override with `TEST_MONGO_URI` environment variable
- Automatically cleaned between tests
- Dropped after all tests complete

