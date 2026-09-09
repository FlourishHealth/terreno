# @terreno/test

Shared Bun test helpers for Terreno backend packages: in-memory MongoDB lifecycle, auth env defaults, HTTP fixtures, and log silencing.

## Install

```bash
bun add -d @terreno/test mongoose
```

`mongoose` is a peer dependency (>= 8.0.0).

## Commands

From the `@terreno/test` package directory:

```bash
bun run compile    # Compile TypeScript
bun run test       # Run package tests
bun run lint       # Lint code
```

Consumers typically run `bun test` in their own package with a `bunfig.toml` preload (see below).

## Preload pattern

Add a `bunfig.toml` preload that wires MongoDB and test env before any test file runs. Example from `admin-backend/bunfig.toml`:

```toml
[test]
preload = ["./src/tests/bunSetup.ts"]
root = "./src"
```

Example preload (`admin-backend/src/tests/bunSetup.ts`):

```typescript
import {registerSimpleMongoPreload} from "@terreno/test";

process.env.TERRENO_TEST_USE_MEMORY_MONGO = "true";

registerSimpleMongoPreload({
  testEnv: {
    tokenIssuer: "terreno-admin-backend.test",
  },
});
```

The `@terreno/api` package uses a two-file preload (`api/bunfig.toml`): `./src/tests/testEnv.ts` then `./src/tests/bunSetup.ts`, which calls `registerBackendPreload` or `registerSimpleMongoPreload` depending on fixture-cache settings.

Import the memory-Mongo flag alone when you only need the env var:

```typescript
import "@terreno/test/preload/memoryMongo";
```

That sets `TERRENO_TEST_USE_MEMORY_MONGO=true` before other preload logic runs.

## Test environment

Call `setTerrenoTestEnv()` from a preload or `beforeEach` to apply canonical auth secrets and validate required vars (via internal `setupTestEnvironment()`):

```typescript
import {setTerrenoTestEnv} from "@terreno/test";

setTerrenoTestEnv({
  tokenIssuer: "my-package.test",
  tokenSecret: "secret",
  refreshTokenSecret: "refresh",
  sessionSecret: "session",
});
```

Defaults: `TOKEN_SECRET`, `TOKEN_ISSUER`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET`, `NODE_ENV=test`, `TZ=UTC`.

## Environment variables

| Variable | Effect |
|----------|--------|
| `TERRENO_TEST_USE_MEMORY_MONGO` | When `"true"`, `registerSimpleMongoPreload` starts `mongodb-memory-server` if `TERRENO_TEST_MONGODB_URI` is unset. |
| `TERRENO_TEST_MONGODB_URI` | External MongoDB URI. Takes priority over in-memory server in `startMongoServer` and `registerSimpleMongoPreload`. |
| `BUN_TEST_DISABLE_DB` | When `"true"`, `registerBackendPreload` skips all Mongo `beforeAll`/`afterAll` hooks (no DB startup). |

`startMongoServer` also publishes the resolved URI to `TERRENO_TEST_MONGO_URI` and honors `TERRENO_TEST_USE_REPLSET=true` for replica-set memory servers.

## Exported helpers

| Export | Description |
|--------|-------------|
| `registerBackendPreload` | Full lifecycle: memory/external Mongo, optional transactions, Sentry mock, log silencing. |
| `registerSimpleMongoPreload` | Lightweight connect-once pattern (used by most packages). |
| `setTerrenoTestEnv` | Apply and validate auth test env vars. |
| `startMongoServer` / `stopMongoServer` | Start or stop shared in-memory Mongo and connect mongoose. |
| `getMongoServerUri` | Resolved URI after `startMongoServer`. |
| `getBaseServer` | Build an Express app for supertest from route registrars. |
| `authAsUser` | Login helper returning auth headers for supertest. |
| `createMongoTestCache` | Fixture-cache controller for fast `@terreno/api` tests. |
| `registerLogSilencing` / `createLogSilencer` | Suppress Winston noise in tests. |
| `registerSentryBunMock` | Mock `@sentry/bun` in preload. |
| `ensureTestMongooseConnected` | Connect mongoose to test URI with retries. |
| `waitForDocument` / `waitForDocuments` | Poll until documents match a query. |
| `startTestTransaction` / `abortTestTransaction` | Per-test mongoose transactions when enabled. |

## Conventions

- Preload once per package via `bunfig.toml`; do not start Mongo in individual test files.
- Prefer `registerSimpleMongoPreload` unless you need transactions or fixture caching (`registerBackendPreload`).
- Never mock `@terreno/api` or Mongoose models in package tests — use the real stack against memory Mongo.

## Coverage gates

Package CI uses `scripts/check-coverage.ts` to enforce the package-wide thresholds
declared in `bunfig.toml`.

Pull requests also run the `New file coverage` workflow. Every newly added workspace
`.ts` or `.tsx` implementation file must have at least 90% function coverage and 90%
line coverage. Test, spec, story, generated OpenAPI SDK, `dist`, isolated-test,
`src/types` type modules, demo `story-config/*.config.tsx`, and Expo Router route
files (`index`, `_layout`, `+not-found`, `[param]`, plus example recovery screens
`forgotPassword` / `resetPassword` / `verifyEmail`) are excluded. A new implementation
file that is absent from LCOV is treated as 0% covered. The gate runs each package's `bun test` file arguments (or `src` / `*.test.ts`
globs) so Playwright `*.spec.ts` files are not collected. Globs are expanded in
the coverage process before `bun test` is spawned, because spawn does not pass
them through a shell. A glob that matches no files is omitted.

Run the same check locally against a base commit:

```bash
bun run check:new-file-coverage --base=origin/master --threshold=90
```
