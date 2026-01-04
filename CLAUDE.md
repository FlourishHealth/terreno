# Terreno

A monorepo containing shared packages for building full-stack applications with React Native and Express/Mongoose.

## Packages

- **api/** - REST API framework built on Express/Mongoose (`@terreno/api`)
- **ui/** - React Native UI component library (`@terreno/ui`)
- **rtk/** - Redux Toolkit Query utilities for API backends (`@terreno/rtk`)
- **demo/** - Demo app for showcasing and testing UI components
- **frontend-example/** - Example Expo app demonstrating full stack usage
- **backend-example/** - Example Express backend using @terreno/api

## Development

Uses [Bun](https://bun.sh/) as the package manager. Use `yarn` commands, not `npm`.

```bash
bun install              # Install dependencies
bun run compile          # Compile all packages
bun run lint             # Lint all packages
bun run lint:fix         # Fix lint issues
bun run test             # Run tests in api and ui
```

### Package-specific commands

```bash
bun run api:test         # Test API package
bun run ui:test          # Test UI package
bun run demo:start       # Start demo app
bun run frontend:web     # Start frontend example
bun run backend:dev      # Start backend example
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

## Dependency Management

Uses [Bun Catalogs](https://bun.sh/docs/install/catalogs) - shared versions defined in root `package.json` under `catalog`. Reference with `catalog:` in workspace packages.
