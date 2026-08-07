# Changelog

All notable changes to this project are documented in this file.

All `@terreno/*` packages (`api`, `test`, `ui`, `rtk`, `admin-backend`,
`admin-frontend`, `admin-spa`, `ai`, `api-health`, `feature-flags`, `mcp`) are
versioned in lockstep and published at the same version.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
