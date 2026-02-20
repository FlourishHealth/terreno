# Contributing to Terreno

Thank you for your interest in contributing to Terreno! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0.0
- MongoDB (for backend development)
- Node.js 18+ (for compatibility testing)
- Git

### Initial Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/terreno.git
   cd terreno
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Verify setup**

   ```bash
   # Compile all packages
   bun run compile
   
   # Run linters
   bun run lint
   
   # Run tests
   bun run test
   ```

4. **Set up MongoDB** (for @terreno/api development)

   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo
   
   # Or install locally
   # macOS: brew install mongodb-community
   # Ubuntu: sudo apt-get install mongodb
   ```

## Development Workflow

### Branch Strategy

- `master` - Production-ready code, protected branch
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/topic` - Documentation updates

### Making Changes

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Write code following our [code style](#code-style)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**

   ```bash
   # Run affected package tests
   bun run api:test
   bun run ui:test
   
   # Run all tests
   bun run test
   
   # Lint code
   bun run lint
   
   # Fix lint issues
   bun run lint:fix
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Test additions or updates
   - `chore:` - Build process or auxiliary tool changes

5. **Push and create a pull request**

   ```bash
   git push origin feature/your-feature-name
   ```

   Then open a pull request on GitHub.

## Code Style

### TypeScript/JavaScript

- **ES Modules**: Use `import`/`export` syntax
- **TypeScript**: Always use TypeScript, provide explicit types
- **Interfaces over Types**: Prefer `interface` over `type`
- **No Enums**: Use maps or string literals instead
- **Arrow Functions**: Prefer `const foo = () => {}` over `function foo() {}`
- **Naming**: Use descriptive names with auxiliary verbs (`isLoading`, `hasError`)
- **Directory Names**: Use camelCase (`components/authWizard`)
- **Named Exports**: Prefer named exports over default exports
- **RORO Pattern**: Receive an Object, Return an Object for functions with multiple parameters

### React/React Native

- **Functional Components**: Always use functional components with `React.FC`
- **Hooks**: Import directly: `import {useState, useEffect} from 'react'`
- **Return Types**: Always provide explicit return types
- **useEffect**: Add explanatory comment above each `useEffect`
- **Callbacks**: Wrap event handlers in `useCallback`
- **Inline Styles**: Prefer inline styles over `StyleSheet.create`
- **Luxon**: Use Luxon for all date operations (never `Date` or `dayjs`)
- **Cross-platform**: Always support React Native Web

### Backend (@terreno/api)

- **Error Handling**: Check errors early, return early
- **APIError**: Use `throw new APIError({status: 400, title: "..."})` for HTTP errors
- **Mongoose**: Never use `Model.findOne` — use `Model.findExactlyOne` or `Model.findOneOrThrow`
- **Model Types**: All interfaces in `src/types/models/`
- **Methods/Statics**: Define by direct assignment: `schema.methods = {foo() {}}`
- **Logging**: Use `logger.info/warn/error/debug`, never `console.log`

### Linting

We use [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check all code
bun run lint

# Fix issues automatically
bun run lint:fix

# Format code
bun run format
```

Biome configuration is in `biome.jsonc` at the root and in each package.

## Testing

### Test Framework

We use Bun's built-in test runner with `expect` assertions:

```typescript
import {describe, expect, it} from "bun:test";

describe("MyFeature", () => {
  it("should do something", () => {
    expect(result).toBe(expected);
  });
});
```

### Running Tests

```bash
# All tests
bun run test

# Specific package
bun run api:test
bun run ui:test

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

### Writing Tests

- **Test files**: `*.test.ts` or `*.test.tsx`, placed next to the code they test
- **Test coverage**: Aim for ≥80% coverage on new code
- **Unit tests**: Test individual functions and components
- **Integration tests**: Test API endpoints with supertest
- **No mocking**: Don't mock @terreno/api or models — test real functionality
- **UI tests**: Use `@testing-library/react-native` with `renderWithTheme` helper

### Example: API Test

```typescript
import {describe, expect, it} from "bun:test";
import request from "supertest";
import {getBaseServer, setupDb} from "@terreno/api";

describe("POST /todos", () => {
  setupDb();

  it("creates a todo", async () => {
    const app = getBaseServer();
    const response = await request(app)
      .post("/todos")
      .send({title: "Test todo"})
      .expect(201);

    expect(response.body.title).toBe("Test todo");
  });
});
```

### Example: UI Test

```typescript
import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "./test-utils";
import {Button} from "./Button";

describe("Button", () => {
  it("renders correctly", () => {
    const {getByTestId} = renderWithTheme(
      <Button text="Click me" onClick={() => {}} testID="btn" />
    );
    expect(getByTestId("btn")).toBeTruthy();
  });
});
```

## Documentation

Documentation is treated as code and kept in sync with implementation.

### Types of Documentation

Following the [Diátaxis framework](https://diataxis.fr/):

1. **Tutorials** (`docs/tutorials/`) - Learning-oriented, hands-on lessons
2. **How-to guides** (`docs/how-to/`) - Problem-oriented, practical steps
3. **Reference** (`docs/reference/`) - Information-oriented, technical specs
4. **Explanation** (`docs/explanation/`) - Understanding-oriented, clarification

### Documentation Requirements

- **New features**: Update relevant documentation
- **API changes**: Update reference docs and migration guides
- **Breaking changes**: Document in migration guide with before/after examples
- **Package READMEs**: Keep package-level READMEs up to date

### Markdown Style

- Use standard Markdown (`.md`) — MDX only when interactive components are needed
- Active voice, plain English
- Progressive disclosure: high-level first, details later
- Include code examples
- Test all code examples to ensure they work

### AI Rules Management

This project uses [rulesync](https://github.com/dyoshikawa/rulesync) for AI assistant rules:

1. **Edit rules**: Modify files in `.rulesync/rules/`
2. **Generate**: Run `bun run rules` to regenerate tool-specific files
3. **Commit both**: Source rules and generated files

Rules are checked in CI (`rulesync-check.yml`).

## Pull Request Process

### Before Submitting

- [ ] Code compiles without errors: `bun run compile`
- [ ] All tests pass: `bun run test`
- [ ] Linting passes: `bun run lint`
- [ ] Documentation updated (if applicable)
- [ ] AI rules updated (if changing conventions): `bun run rules`
- [ ] Example apps updated (if changing core packages)

### PR Template

```markdown
## Summary

Brief description of the changes.

## Changes

- Change 1
- Change 2
- Change 3

## Testing

Describe how you tested the changes.

## Documentation

- [ ] Updated docs/
- [ ] Updated package README
- [ ] Updated example apps (if applicable)

## Breaking Changes

List any breaking changes and migration steps.

## Related Issues

Fixes #123
Related to #456
```

### Review Process

1. **Automated checks**: All CI checks must pass
2. **Code review**: At least one maintainer approval required
3. **Testing**: Reviewer should test locally if possible
4. **Documentation**: Documentation changes reviewed for clarity
5. **Merge**: Squash and merge to keep commit history clean

## Release Process

Releases are automated via GitHub Actions. See [README.md](README.md#releasing) for details.

### Creating a Release

1. Go to [Releases page](../../releases)
2. Click "Draft a new release"
3. Create tag with version number (e.g., `1.2.0` — no `v` prefix)
4. Add release notes
5. Publish release

The workflow automatically:
- Detects which packages changed
- Publishes changed packages to npm
- Creates PR to update versions in repo
- Sends Slack notification

### Version Numbers

Follow [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

All published packages (`@terreno/api`, `@terreno/ui`, `@terreno/rtk`) are versioned together.

## Package Development

### Adding a New Package

1. Create package directory in workspace
2. Add `package.json` with workspace dependency references
3. Add to root `package.json` workspaces array
4. Add compile/lint/test scripts to root `package.json`
5. Create README.md
6. Add to `docs/reference/`
7. Update main README.md

### Dependency Management

Use [Bun Catalogs](https://bun.sh/docs/install/catalogs):

1. **Add to catalog**: Update root `package.json` `catalog` field
2. **Reference in packages**: Use `"dependency": "catalog:"` in workspace packages
3. **Install**: Run `bun install`

This ensures consistent versions across packages.

## Getting Help

- **Documentation**: Check [docs/](docs/)
- **Issues**: Search existing issues or create a new one
- **Discussions**: Start a discussion for questions
- **Examples**: Review `example-backend/` and `example-frontend/`

## License

By contributing to Terreno, you agree that your contributions will be licensed under the Apache-2.0 License.

## Recognition

Contributors will be recognized in release notes and the project README.

Thank you for contributing to Terreno! 🎉
