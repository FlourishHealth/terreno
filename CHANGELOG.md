# Changelog

All notable changes to this project are documented in this file.

All `@terreno/*` packages (`api`, `test`, `ui`, `rtk`, `admin-backend`,
`admin-frontend`, `admin-spa`, `ai`, `api-health`, `comms`, `feature-flags`, `mcp`,
`syncdb`) are versioned in lockstep and published at the same version.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Model Context Protocol support in `modelRouter` via an `mcp` option: opted-in
  models expose their CRUD operations as MCP tools at `POST /mcp`, reusing the
  same permissions, query filters, population, and lifecycle hooks as REST
  ([#358](https://github.com/FlourishHealth/terreno/pull/358))
- `getMCPTools(user)` in `@terreno/api` returns the same tools as Vercel AI SDK
  tool objects for in-process use from a chat route
- MCP list filters accept Mongo comparison operators (`$in`, `$gte`, `$ne`, and
  friends) and top-level `$and` / `$or` on fields listed in `queryFields`;
  operators that can execute code (`$where`, `$expr`, `$function`) are rejected
- `useMCPTools()` and `useTerrenoChat()` hooks in `@terreno/rtk`
- How-to guide for exposing MCP tools from a Terreno backend
- MCP HTTP and stdio servers now use the TypeScript SDK v2 and support the
  stateless `2026-07-28` protocol revision while retaining stateless legacy
  compatibility; `useMCPTools()` uses the official v2 client instead of
  hand-written JSON-RPC/SSE handling
- Generated model tools emit structured success/refusal/failure logs with
  request correlation, duration, stable MCP labels, and Sentry exception
  capture for internal failures
- `@terreno/syncdb` documentation: reference (`docs/reference/syncdb.md`), migration guide
  (`docs/how-to/migrate-rtk-to-syncdb.md`), and local-first explainer
  (`docs/explanation/local-first-data.md`)
- `terreno_bootstrap_app` scaffolds Better Auth + `@terreno/syncdb` (replica-set MongoDB,
  `SyncApp`/`RealtimeApp`, `SyncDbProvider`) instead of JWT `generateAuthSlice`
- `SendGridMailProvider` at `@terreno/comms/adapters/sendgrid` (optional peer
  `@sendgrid/mail`) with sandbox mode, `errorCode`/`errorClass` taxonomy, Email Activity
  deep links, and one transient retry via `CommsService` hooks (`onError` / `onRetry` /
  `onSend`).
- `@terreno/syncdb` documentation: reference (`docs/reference/syncdb.md`), migration guide
  (`docs/how-to/migrate-rtk-to-syncdb.md`), and local-first explainer
  (`docs/explanation/local-first-data.md`)
- `terreno_bootstrap_app` scaffolds Better Auth + `@terreno/syncdb` (replica-set MongoDB,
  `SyncApp`/`RealtimeApp`, `SyncDbProvider`) instead of JWT `generateAuthSlice`

### Deprecated

- **`@terreno/rtk` for data synchronization** — deprecated as of **56.0.0**. Still published
  through the current major line; will not ship in the next major. Migrate collection CRUD to
  [`@terreno/syncdb`](docs/reference/syncdb.md) using
  [migrate-rtk-to-syncdb.md](docs/how-to/migrate-rtk-to-syncdb.md). Continue using `@terreno/rtk`
  for the OpenAPI SDK, Better Auth Redux, feature flags, and sockets.

### Fixed

- MCP create/update apply REST `validation.excludeFromCreate` /
  `excludeFromUpdate` as a write denylist on both the persist payload and the
  fake request body passed to lifecycle hooks, matching HTTP body validation
- MCP read/update/delete return a structured not-found error for invalid
  ObjectIds instead of crashing on Mongoose `CastError`, while still accepting
  mixed-case 24-hex ids the way REST `findById` does
- MCP list returns a structured error when `queryFilter` throws, matching REST
  400 handling

### Deprecated

- **`@terreno/rtk` for data synchronization** — deprecated as of **56.0.0**. Still published
  through the current major line; will not ship in the next major. Migrate collection CRUD to
  [`@terreno/syncdb`](docs/reference/syncdb.md) using
  [migrate-rtk-to-syncdb.md](docs/how-to/migrate-rtk-to-syncdb.md). Continue using `@terreno/rtk`
  for the OpenAPI SDK, Better Auth Redux, feature flags, and sockets.

## [57.0.0] - 2026-08-20

First stable release of the Expo SDK 57 line, cut from `master` after
[`#1065`](https://github.com/FlourishHealth/terreno/pull/1065). Publishes to the npm
`latest` dist-tag. Apps on `0.x` should stay pinned until they upgrade Expo.

### Added

- `Filter` and its composable select, boolean, accordion, and change-badge controls in
  `@terreno/ui` for desktop web filtering flows
  ([#972](https://github.com/FlourishHealth/terreno/pull/972))

### Changed

- Terreno's version major now tracks Expo SDK 57 (`57.x.y`). `npm install @terreno/ui`
  resolves to this line; pin `0.x` if the app has not upgraded Expo yet
  ([#1065](https://github.com/FlourishHealth/terreno/pull/1065))
- Frontend peer/catalog stack moves to Expo SDK 57 / React Native 0.86.2
  (`expo ~57.0.14`, matching React Native DevTools and Hermes V1 fixes from
  `expo@57.0.9+`). React stays at `19.2.3`. Consuming apps should run
  `npx expo install expo@latest --fix` then rebuild native binaries
  ([#1065](https://github.com/FlourishHealth/terreno/pull/1065))
- `@terreno/syncdb` bumps `tinybase` to `^9.5.1` for Expo SDK 57 /
  `expo-sqlite` type compatibility   ([#1065](https://github.com/FlourishHealth/terreno/pull/1065))

## [57.0.0-beta.1] - 2026-08-20

First beta of the Expo SDK 57 line, cut from `master` after merging
[`#1065`](https://github.com/FlourishHealth/terreno/pull/1065). Publishes under the npm
`beta` dist-tag; `npm install @terreno/ui` still resolves to the stable `0.x` line.

### Added

- `Filter` and its composable select, boolean, accordion, and change-badge controls in
  `@terreno/ui` for desktop web filtering flows
  ([#972](https://github.com/FlourishHealth/terreno/pull/972))

### Changed

- Terreno's version major now tracks Expo SDK 57 (`57.x.y`). The stable `0.x` packages are
  unaffected; this beta does not move `latest`
  ([#1065](https://github.com/FlourishHealth/terreno/pull/1065))
- Frontend peer/catalog stack moves to Expo SDK 57 / React Native 0.86.2
  (`expo ~57.0.14`, matching React Native DevTools and Hermes V1 fixes from
  `expo@57.0.9+`). React stays at `19.2.3`. Consuming apps should run
  `npx expo install expo@latest --fix` then rebuild native binaries
  ([#1065](https://github.com/FlourishHealth/terreno/pull/1065))
- `@terreno/syncdb` bumps `tinybase` to `^9.5.1` for Expo SDK 57 /
  `expo-sqlite` type compatibility ([#1065](https://github.com/FlourishHealth/terreno/pull/1065))

## [56.0.0-beta.2] - 2026-08-17

Second beta of the Expo SDK 56 line, cut from `master` after merging
[`#976`](https://github.com/FlourishHealth/terreno/pull/976). Publishes under the npm
`beta` dist-tag; `npm install @terreno/ui` still resolves to the stable `0.x` line.

### Added

- Expo SDK 56 target for frontend packages: `expo ~56.0.12`, `react-native 0.85.3`,
  `react 19.2.3`, TypeScript 6
  ([#976](https://github.com/FlourishHealth/terreno/pull/976))
- `@terreno/syncdb` local-first data layer (TinyBase MergeableStore, durable outbox,
  websocket delta sync, encrypted web persistence) plus `SyncApp` / sync protocol support
  in `@terreno/api`
  ([#976](https://github.com/FlourishHealth/terreno/pull/976))
- `SyncStatusBanner` and `ConflictSheet` in `@terreno/ui` for sync UX
  ([#976](https://github.com/FlourishHealth/terreno/pull/976))
- `@terreno/comms` with pluggable mail, SMS, push, and verification contracts, console
  development providers, delivery logging, owner-scoped push-token routes, an admin delivery
  explorer, and generated RTK Query hooks
  ([#1037](https://github.com/FlourishHealth/terreno/pull/1037))

### Changed

- Terreno's version major now tracks the Expo SDK major it targets (`56.x.y` for Expo 56).
  The stable `0.x` packages are unaffected; this beta does not move `latest`
  ([#976](https://github.com/FlourishHealth/terreno/pull/976))
- Frontend peer/catalog stack moves to Expo 56 / React Native 0.85 / React 19.2 /
  TypeScript 6 — consuming apps must upgrade Expo before installing this beta
  ([#976](https://github.com/FlourishHealth/terreno/pull/976))
- `excludeArchivedPlugin` now filters `findOne` the same way as `find`, matching
  `isDeletedPlugin`
- Sync/REST CRUD executors preserve kebab-case error `code` values
  (`create-not-allowed`, `update-not-allowed`, `delete-not-allowed`,
  `invalid-request-body`) and status-specific error names on hook-rejection paths
- Publish workflow pins `@terreno/ui` to the release version for prerelease
  `admin-frontend` / `admin-spa` publishes (same as `ui` / `rtk`)
- Catalog `@shopify/react-native-skia` bumped to `2.6.5` (drops the postinstall that
  could hang `bun install --frozen-lockfile`); removed unused payment/native deps from
  `example-frontend`
- The `terreno-5-dialin` plugin skill now owns merge conflicts that appear after the
  Pour handoff: it checks PR mergeability each cycle, resolves conflicts by merging the
  base branch without rewriting pushed history, re-runs checks and frontend
  verification, and treats a conflicted PR as broken rather than mergeable
  ([#1039](https://github.com/FlourishHealth/terreno/pull/1039))

### Fixed

- `generateTokens` in `@terreno/api` now logs and falls back to its default expiration when
  `TOKEN_EXPIRES_IN` or `REFRESH_TOKEN_EXPIRES_IN` is not a valid duration, instead of throwing
  from `jwt.sign`
- Sync seq claims under Mongoose 9: `claimSyncSeqs` passes `updatePipeline: true` for
  its aggregation-pipeline `findOneAndUpdate` (required after the master mongoose 9 merge)
- `RealtimeApp` accepts injectable `SocketServer` / `startChangeStreamWatcher` so setup
  tests no longer use process-wide `mock.module` (which broke socketAuth + sync integration)
- Mongoose 9 `insertMany` probe in `syncFrontier.test.ts` no longer calls removed `next()`
- Sync save error middleware: `throw` instead of `next(error)` under Mongoose 9/Kareem 3,
  and release pending seq claims on any failed claimed save (not only VersionError)
- Drop orphaned `ui` consent-history PDF test left after the move to `admin-frontend`

## [0.31.0] - 2026-08-11

### Added

- `EditableCard` in `@terreno/ui`: a summary card with an optional icon, badge,
  description, helper text, edit button, and attention state
  ([#981](https://github.com/FlourishHealth/terreno/pull/981))
- MIT `LICENSE` file in every published package, plus contribution guide, changelog,
  and GitHub issue/PR templates ([#985](https://github.com/FlourishHealth/terreno/pull/985))
- Public roadmap generated from `docs/` into GitHub, with `roadmap:generate` /
  `roadmap:check` scripts and roadmap discussion setup
  ([#986](https://github.com/FlourishHealth/terreno/pull/986), [#991](https://github.com/FlourishHealth/terreno/pull/991))
- `check:upgrade-docs` release gate that fails a tagged publish when a release
  documents breaking, changed, deprecated, or removed behavior without an
  `mcp-server/src/docs/upgrades/<version>.md` note ([#987](https://github.com/FlourishHealth/terreno/pull/987))
- Deployment foundation for GCP, deploy guides, and agentic SDLC plugin phase 1
  ([#988](https://github.com/FlourishHealth/terreno/pull/988))
- Reference documentation for `@terreno/ai`, `@terreno/admin-spa`, and `@terreno/test`,
  plus full READMEs for `admin-backend`, `admin-frontend`, `ai`, and `api-health`
  ([#995](https://github.com/FlourishHealth/terreno/pull/995))

### Changed

- Mongoose 9 support: the workspace runs on Mongoose 9.7.4 and every published
  package widens its `mongoose` peer dependency to `^8.0.0 || ^9.0.0`, so Mongoose 8
  consumers keep working ([#984](https://github.com/FlourishHealth/terreno/pull/984))
- All published packages are MIT licensed; they were previously Apache-2.0
  ([#985](https://github.com/FlourishHealth/terreno/pull/985))
- `modelRouter` accepts a wider Mongoose model generic, so models carrying custom
  query helpers, methods, or virtuals no longer need a cast ([#984](https://github.com/FlourishHealth/terreno/pull/984))
- `findOneOrNoneFor` takes `ModelQuery<T>` instead of Mongoose's `FilterQuery<T>`
  ([#984](https://github.com/FlourishHealth/terreno/pull/984))
- `@terreno/admin-backend` reads array field metadata through Mongoose's public
  `getEmbeddedSchemaType()` (falling back to the Mongoose 8 `caster`) and only emits
  `itemEnum` when the embedded enum is an array ([#984](https://github.com/FlourishHealth/terreno/pull/984))
- Local development requires Node >= 20.19.0 ([#984](https://github.com/FlourishHealth/terreno/pull/984))
- Positioning copy blocks and an honest framework comparison table
  ([#993](https://github.com/FlourishHealth/terreno/pull/993))
- Implementation plans and program docs for the infrastructure MCP server, the B2B
  platform program, the IP + roadmap flow, and the RTK-to-syncdb migration strategy,
  with merged plans linked to their roadmap tracking issues
  ([#990](https://github.com/FlourishHealth/terreno/pull/990), [#996](https://github.com/FlourishHealth/terreno/pull/996), [#998](https://github.com/FlourishHealth/terreno/pull/998), [#999](https://github.com/FlourishHealth/terreno/pull/999), [#1028](https://github.com/FlourishHealth/terreno/pull/1028))
- Test coverage, rule alignment, and explicit-any remediation across `api`, `ui`, and `rtk`
  ([#946](https://github.com/FlourishHealth/terreno/pull/946), [#977](https://github.com/FlourishHealth/terreno/pull/977), [#978](https://github.com/FlourishHealth/terreno/pull/978), [#979](https://github.com/FlourishHealth/terreno/pull/979), [#980](https://github.com/FlourishHealth/terreno/pull/980), [#982](https://github.com/FlourishHealth/terreno/pull/982), [#983](https://github.com/FlourishHealth/terreno/pull/983), [#1000](https://github.com/FlourishHealth/terreno/pull/1000), [#1001](https://github.com/FlourishHealth/terreno/pull/1001), [#1002](https://github.com/FlourishHealth/terreno/pull/1002))

### Fixed

- CI queues `terreno-example` EAS native builds only for new fingerprints
  ([#965](https://github.com/FlourishHealth/terreno/pull/965))
- Keep the Dial In PR loop active through slow or pending CI, and only return
  broken checks when no autonomous action can advance them or user direction is
  required ([#1027](https://github.com/FlourishHealth/terreno/pull/1027))
- Dial In preserves existing PR descriptions instead of overwriting them
  ([#1030](https://github.com/FlourishHealth/terreno/pull/1030))

## [0.30.0] - 2026-08-03

### Added

- `ThumbsUpDownFeedback` UI component ([#948](https://github.com/FlourishHealth/terreno/pull/948))

### Fixed

- Pass `APIError` context through `modelRouter` without re-wrapping errors raised
  inside hooks or Mongoose middleware ([#967](https://github.com/FlourishHealth/terreno/pull/967))
- `modelRouter` no longer drops `status`, `title`, `detail`, `code`, and `meta`
  when re-throwing an `APIError` from create/update/delete handlers, populate,
  `queryFilter`, list serialization, or array-operation paths
- Mongoose validation and cast errors from `modelRouter` writes surface per-field
  messages via `meta.fields` again instead of generic wrapper titles
- `queryFilter` wrapper details use readable message extraction instead of
  `String(error)`
- Framework-thrown errors follow the 0.28.0 contract: stable `title`, per-occurrence
  text in `detail`, kebab-case `code`, and status subclasses where applicable
- `apiUnauthorizedMiddleware` only matches plain `Error("Unauthorized")`, so a
  `ForbiddenError` titled `"Unauthorized"` stays 403

### Changed

- Add `errorDetail(error)` helper for nested `APIError` detail in framework wrappers
- Test coverage, rule alignment, and explicit-any remediation commits ([#959](https://github.com/FlourishHealth/terreno/pull/959), [#963](https://github.com/FlourishHealth/terreno/pull/963), [#968](https://github.com/FlourishHealth/terreno/pull/968), [#969](https://github.com/FlourishHealth/terreno/pull/969))

## [0.29.0] - 2026-07-31

### Added

- Typed and draw/type signature capture fields in `@terreno/ui` ([#958](https://github.com/FlourishHealth/terreno/pull/958))
- Short-attention-span skill for action-first AI output ([#956](https://github.com/FlourishHealth/terreno/pull/956))

## [0.28.0] - 2026-07-30

### Added

- Open source launch program: 15 implementation plans, task lists, and the
  `build-terreno-app` dogfooding skill ([#942](https://github.com/FlourishHealth/terreno/pull/942))

### Changed

- Redesign `APIError` to use standard `Error` fields for Sentry grouping ([#949](https://github.com/FlourishHealth/terreno/pull/949))
- Rename `SelectField` `searchable` prop to `disableSearch` ([#954](https://github.com/FlourishHealth/terreno/pull/954))

### Fixed

- Queue only missing platform dev builds on EAS PR slow path ([#955](https://github.com/FlourishHealth/terreno/pull/955))

## [0.27.0] - 2026-07-29

### Added

- Terreno-native agent skills (`building-terreno-apps`, `terreno-data-fetching`,
  `terreno-backend-api`, `terreno-ui`) ([#941](https://github.com/FlourishHealth/terreno/pull/941))
- Explicit-any audit script for tracking `any` usage across the monorepo ([#927](https://github.com/FlourishHealth/terreno/pull/927))
- RBAC permissions API design doc ([#887](https://github.com/FlourishHealth/terreno/pull/887))

### Changed

- Document custom icon registration in `@terreno/ui` ([#910](https://github.com/FlourishHealth/terreno/pull/910))
- Change example-backend seed admin user to `admin@example.com` (password
  unchanged) ([#935](https://github.com/FlourishHealth/terreno/pull/935))
- Require frontend app login, feature exercise, and PR evidence in agent
  workflows ([#915](https://github.com/FlourishHealth/terreno/pull/915))

### Fixed

- Fix `Modal` Confirm button on native Android tablets ([#952](https://github.com/FlourishHealth/terreno/pull/952))
- Guard `@terreno/rtk` web tests against `IsWeb` platform mock leakage ([#934](https://github.com/FlourishHealth/terreno/pull/934))

## [0.26.0] - 2026-07-15

### Added

- `IconButton` gains an `active` interaction state via `state?: "default" | "active"`
  ([#885](https://github.com/FlourishHealth/terreno/pull/885))

### Changed

- Remove internal barrel imports; ban new internal barrel `index.ts` files via
  Biome lint and `check:no-barrel-imports` ([#907](https://github.com/FlourishHealth/terreno/pull/907))
- Order Terreno planning skills by workflow step (`terreno-1-blend` through
  `terreno-5-dialin`) ([#900](https://github.com/FlourishHealth/terreno/pull/900))

### Fixed

- Fix `Table`/`DataTable` preview cards on the demo home page rendering as a
  floating overlay ([#911](https://github.com/FlourishHealth/terreno/pull/911))
- Fix demo, docs, and example-frontend production Netlify deploys silently
  no-opping on push to `master` ([#903](https://github.com/FlourishHealth/terreno/pull/903))
- Fix duplicate `if` keys in example-app E2E and Admin SPA integration workflows
  ([#901](https://github.com/FlourishHealth/terreno/pull/901))
- Stabilize AI and admin frontend test suites ([#902](https://github.com/FlourishHealth/terreno/pull/902))

## [0.25.0] - 2026-07-12

### Added

- `@terreno/api`: HTTP client layer — `createAuthenticatedClient`,
  `normalizeApiError`, and `withApiErrorHandling` ([#870](https://github.com/FlourishHealth/terreno/pull/870))
- `SelectField` / `WebDropdownMenu`: type-to-filter searchable dropdown
  ([#615](https://github.com/FlourishHealth/terreno/pull/615))
- Demo AI palette generator (`/palette`) with WCAG contrast checks ([#863](https://github.com/FlourishHealth/terreno/pull/863))

### Changed

- Add repo subagents and upgrade rulesync to v9 ([#892](https://github.com/FlourishHealth/terreno/pull/892))
- Include run evidence (screenshots/videos) in PRs via submit and pour skills
  ([#871](https://github.com/FlourishHealth/terreno/pull/871))

### Fixed

- `@terreno/api`: return `401` (not `500`) for auth failures in `bun build --compile`
  binaries ([#894](https://github.com/FlourishHealth/terreno/pull/894))
- Website: prune docs versions correctly so `versions.json` stays valid ([#866](https://github.com/FlourishHealth/terreno/pull/866))

## [0.24.0] - 2026-07-03

### Added

- `AiSuggestionBox`: `hidden` suggestion status, condensed collapsed states, race-safe
  expansion, and refreshed sparkles/thumbs visuals ([#865](https://github.com/FlourishHealth/terreno/pull/865))

### Changed

- Test coverage and explicit-any remediation commits ([#852](https://github.com/FlourishHealth/terreno/pull/852), [#851](https://github.com/FlourishHealth/terreno/pull/851), [#861](https://github.com/FlourishHealth/terreno/pull/861), [#862](https://github.com/FlourishHealth/terreno/pull/862))

## [0.23.1] - 2026-07-02

### Added

- Architectural PR review workflow ([#844](https://github.com/FlourishHealth/terreno/pull/844))

### Changed

- Document Cursor Cloud dev-environment setup for example-backend MongoDB ([#845](https://github.com/FlourishHealth/terreno/pull/845))
- Demo Appium CI non-blocking unless a mobile build feature changes ([#846](https://github.com/FlourishHealth/terreno/pull/846))
- Consolidate shared dependencies into Bun catalog ([#848](https://github.com/FlourishHealth/terreno/pull/848))
- Align dev API port with docs; clear required on warning ([#842](https://github.com/FlourishHealth/terreno/pull/842))

### Fixed

- Correct example-backend consent enum snapshot ordering ([#628](https://github.com/FlourishHealth/terreno/pull/628))
- Fix lint regression and iOS Appium smoke timeout ([#843](https://github.com/FlourishHealth/terreno/pull/843))
- Fix E2E todos web server startup in CI ([#811](https://github.com/FlourishHealth/terreno/pull/811))
- Resolve UI and demo formatting CI failures ([#789](https://github.com/FlourishHealth/terreno/pull/789))
- Stop Expo fingerprint churn forcing a native build on every PR ([#849](https://github.com/FlourishHealth/terreno/pull/849))
- `Button`: use transparent background for ghost variant ([#858](https://github.com/FlourishHealth/terreno/pull/858))

## [0.23.0] - 2026-06-26

### Added

- `@terreno/ui` compound components expose predictable dot-suffixed test IDs ([#832](https://github.com/FlourishHealth/terreno/pull/832), [#840](https://github.com/FlourishHealth/terreno/pull/840))
- Admin Script Runner CLI (`runScriptCli`, declared `args` on scripts) ([#828](https://github.com/FlourishHealth/terreno/pull/828))
- Consent response list/read populate `userId`; `ConsentResponseViewer` user section
  ([#833](https://github.com/FlourishHealth/terreno/pull/833))

### Changed

- Document `GCP_SA_*` service account secrets in cloud agent instructions ([#829](https://github.com/FlourishHealth/terreno/pull/829))
- Add example-backend Script Runner CI workflow and CLI docs ([#828](https://github.com/FlourishHealth/terreno/pull/828))

### Fixed

- Equalize `MarkdownEditor` edit and preview pane heights ([#831](https://github.com/FlourishHealth/terreno/pull/831))

## [0.22.2] - 2026-06-24

### Fixed

- `@terreno/api`: declare `@terreno/test` as a runtime dependency so
  `@terreno/api/testing` resolves under isolated installs ([#827](https://github.com/FlourishHealth/terreno/pull/827))

### Changed

- Publish `@terreno/feature-flags` for the first time since `0.21.0`; all packages
  move to `0.22.2` to stay in lockstep

## [0.22.1] - 2026-06-24

### Fixed

- `@terreno/test`: pin `qs` to `^6.14.1` instead of a missing `catalog:` entry so
  the publish workflow succeeds ([#824](https://github.com/FlourishHealth/terreno/pull/824))

### Changed

- Publish `@terreno/test`, `@terreno/ai`, `@terreno/admin-backend`, and
  `@terreno/feature-flags` for the first time at `0.22.1`; all packages move to
  `0.22.1` to stay in lockstep

## [0.22.0] - 2026-06-24

### Added

- New `@terreno/test` package: shared Bun test helpers and in-memory MongoDB fixtures
  ([#822](https://github.com/FlourishHealth/terreno/pull/822), [#823](https://github.com/FlourishHealth/terreno/pull/823))
- `Button`: `ghost` variant and `sm` size; fix `outline` button height ([#816](https://github.com/FlourishHealth/terreno/pull/816))
- `OpenApiMiddlewareBuilder.withOperationId()` for custom OpenAPI `operationId` ([#815](https://github.com/FlourishHealth/terreno/pull/815))

### Changed

- Add SyncDB local-first data layer plan and tasks ([#739](https://github.com/FlourishHealth/terreno/pull/739))

## [0.21.0] - 2026-06-22

### Changed

- **Breaking:** `setupServer` removed — use `TerrenoApp` instead ([#795](https://github.com/FlourishHealth/terreno/pull/795))
- **Breaking:** JSON object responses include `requestId` in the body ([#793](https://github.com/FlourishHealth/terreno/pull/793))

### Added

- Admin UI v2 backend: `schemaVersion: 2` config, bulk-patch, background tasks ([#782](https://github.com/FlourishHealth/terreno/pull/782))
- Traceable API logging: `createScopedLogger`, `createFeatureFlaggedLogger` ([#799](https://github.com/FlourishHealth/terreno/pull/799))
- `Card` redesign: `container` and `display` variants ([#375](https://github.com/FlourishHealth/terreno/pull/375))
- MCP documentation search: `terreno_search_docs`, `terreno_get_component_docs` ([#796](https://github.com/FlourishHealth/terreno/pull/796))
- `@terreno/rtk` exports `devStore` utilities ([#782](https://github.com/FlourishHealth/terreno/pull/782))

### Fixed

- Unblock Dependabot by upgrading `@terreno/ai` multer dependency ([#803](https://github.com/FlourishHealth/terreno/pull/803))
- Fix CI: install workspace deps before Trigger EAS Workflow dispatch ([#805](https://github.com/FlourishHealth/terreno/pull/805))

## [0.20.2] - 2026-06-17

### Changed

- Normalize `Badge` height to 20px; add Badge vs SelectBadge demo ([#751](https://github.com/FlourishHealth/terreno/pull/751))

## [0.20.1] - 2026-06-16

### Added

- `@terreno/ui`: support registering custom icons ([#771](https://github.com/FlourishHealth/terreno/pull/771))
- Expo skills for AI agents ([#777](https://github.com/FlourishHealth/terreno/pull/777))
- Admin UI v2 IP with Django-style `home.slots` ([#775](https://github.com/FlourishHealth/terreno/pull/775))
- `@terreno/ai`: export `./parseAiJson` subpath ([#783](https://github.com/FlourishHealth/terreno/pull/783))

### Changed

- Normalize skill descriptions to single-line UI summaries ([#772](https://github.com/FlourishHealth/terreno/pull/772))

### Fixed

- Restore demo CI ordering checks ([#770](https://github.com/FlourishHealth/terreno/pull/770))
- Fix Appium dev-client smoke tests on Android and iOS ([#773](https://github.com/FlourishHealth/terreno/pull/773))

## [0.16.0] - 2026-06-02

Historical `@terreno/api` release notes preserved from the former
`api/CHANGELOG.md` (packages now version in lockstep from 0.20.0 onward).

### Added

- **`modelRouter` actions** — `instanceActions` and `collectionActions` on
  `ModelRouterOptions` for named operations at `/resource/:id/action` and
  `/resource/action`
- **`loadDocOr404`** — shared document loader used by permission middleware and
  instance actions (soft-delete-aware 404 metadata preserved)

### Changed

- Permission middleware doc loading delegates to `loadDocOr404` (behavior-preserving)

### Dependencies

- Added `@asteasolutions/zod-to-openapi` ^8.5.0
- Added **`zod` ^4.3.6 as a peer dependency** for backends defining action Zod
  schemas

### Migration

- Regenerate frontend SDKs after adding actions; `operationId` values follow
  `{tag}_{actionName}` (e.g. `todos_markComplete`)

## [0.20.0] - 2026-06-14

### Changed

- **Breaking:** `@terreno/api` `ConfigurationApp`: `POST {basePath}/list-secrets` is
  now read-only validation/status — it no longer resolves or returns secret values;
  `PATCH {basePath}` strips `secret: true` fields ([#768](https://github.com/FlourishHealth/terreno/pull/768))
- **`configurationPlugin` no longer adds the `_singleton` unique index by default**
  — opt in via `enforceSingletonIndex: true`
- **`configurationPlugin` singleton semantics are soft-delete aware**
- **`configurationPlugin.updateConfig` applies updates via `findOneAndUpdate({$set})`
  with dotted paths** instead of `Object.assign` + `doc.save()`
- Prefix `terreno-planning` Cursor plugin skills with `terreno-` ([#764](https://github.com/FlourishHealth/terreno/pull/764))
- Submit skill: merge-first PR body updates ([#765](https://github.com/FlourishHealth/terreno/pull/765))

### Added

- `@terreno/api` configuration and secret upgrades: `CompositeSecretProvider`,
  `CachingSecretProvider`, pluggable `permissions`, `preUpdate`/`postUpdate` hooks,
  optional `version` on secret resolution ([#768](https://github.com/FlourishHealth/terreno/pull/768))
- OpenFeature migration for feature flags: `MongoFeatureFlagProvider`,
  `GET …/flagConfiguration`, `useTerrenoFeatureFlags` hook ([#761](https://github.com/FlourishHealth/terreno/pull/761))
- `SecretProvider.getSecret(secretName, version?)` and `flattenToDotPaths` export

### Deprecated

- Legacy `GET …/evaluate` feature-flag endpoint (sends `Deprecation`/`Sunset` headers)
  ([#761](https://github.com/FlourishHealth/terreno/pull/761))

[57.0.0]: https://github.com/FlourishHealth/terreno/releases/tag/57.0.0
[57.0.0-beta.1]: https://github.com/FlourishHealth/terreno/releases/tag/57.0.0-beta.1
[56.0.0-beta.2]: https://github.com/FlourishHealth/terreno/releases/tag/56.0.0-beta.2
[0.30.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.30.0
[0.29.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.29.0
[0.28.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.28.0
[0.27.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.27.0
[0.26.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.26.0
[0.25.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.25.0
[0.24.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.24.0
[0.23.1]: https://github.com/FlourishHealth/terreno/releases/tag/0.23.1
[0.23.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.23.0
[0.22.2]: https://github.com/FlourishHealth/terreno/releases/tag/0.22.2
[0.22.1]: https://github.com/FlourishHealth/terreno/releases/tag/0.22.1
[0.22.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.22.0
[0.21.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.21.0
[0.20.2]: https://github.com/FlourishHealth/terreno/releases/tag/0.20.2
[0.20.1]: https://github.com/FlourishHealth/terreno/releases/tag/0.20.1
[0.20.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.20.0
[0.16.0]: https://github.com/FlourishHealth/terreno/releases/tag/0.16.0
