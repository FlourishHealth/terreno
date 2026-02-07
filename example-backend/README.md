# Backend

Backend API built with @terreno/api, Bun, and MongoDB.

## Setup

1. Install dependencies:
```bash
bun install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Make sure MongoDB is running locally or update `MONGO_URI` in `.env`

### Environment Variables

Bun automatically loads `.env` files before your code runs — no `dotenv` package needed. Just place a `.env` file in the project root and access variables via `process.env`. Bun loads these files in order of priority:

1. `.env.local` (highest priority)
2. `.env.development` / `.env.production` (based on `NODE_ENV`)
3. `.env` (lowest priority)

See [Bun .env docs](https://bun.sh/docs/runtime/env) for details.

## Development

Start the development server with hot reload:
```bash
bun run dev
```

## Scripts

- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server
- `bun run build` - Build for production
- `bun test` - Run tests
- `bun test --watch` - Run tests in watch mode
- `bun test --coverage` - Run tests with coverage report
- `bun run lint` - Check code with Biome
- `bun run lint:fix` - Fix linting issues
- `bun run format` - Format code with Biome

## Project Structure

```
src/
├── api/           # API route handlers
├── constants/     # Application constants
├── models/        # Mongoose models
├── scripts/       # Utility scripts
├── services/      # Business logic services
├── tasks/         # Background tasks
├── test/          # Test setup and helpers
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Testing

Tests are written using Bun's built-in test runner with expect assertions.

- Test files: `*.test.ts` (placed next to the code they test)
- Test setup: `src/test/setup.ts` (automatically loaded)
- Test helpers: `src/test/helpers.ts`

See [src/test/README.md](src/test/README.md) for detailed testing documentation.

**Running tests:**
```bash
bun test              # Run all tests
bun test --watch      # Watch mode
bun test --coverage   # With coverage report
```

