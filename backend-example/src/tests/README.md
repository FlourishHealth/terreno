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
import { assert } from "chai";
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

    assert.exists(user._id);
    assert.strictEqual(user.email, email);
  });
});
```

### Using Chai Assertions

We use Chai's `assert` style (not `expect`) per project conventions:

```typescript
import { assert } from "chai";

// Good
assert.strictEqual(actual, expected);
assert.exists(value);
assert.include(haystack, needle);

// Avoid
expect(actual).to.equal(expected);
```

### Testing APIErrors

When testing services that throw APIError, check for properties:

```typescript
try {
  await userService.createUser("", "");
  assert.fail("Should have thrown error");
} catch (error: unknown) {
  assert.exists(error.status);
  assert.exists(error.title);
  assert.strictEqual(error.status, 400);
  assert.include(error.title.toLowerCase(), "required");
}
```

## Test Database

The test database is separate from development:
- Default: `mongodb://localhost:27017/ferns-example-test`
- Override with `TEST_MONGO_URI` environment variable
- Automatically cleaned between tests
- Dropped after all tests complete

