# Changelog

All notable changes to this project are documented in this file.

All `@terreno/*` packages (`api`, `test`, `ui`, `rtk`, `admin-backend`,
`admin-frontend`, `admin-spa`, `ai`, `api-health`, `comms`, `feature-flags`, `mcp`,
`syncdb`) are versioned in lockstep and published at the same version.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Unreleased changes live in [`changelog/unreleased/`](changelog/unreleased/) as one
file per feature. `bun run changelog:assemble <version>` folds those files into a
dated section below when cutting a release.

Upgrade notes for consumer action live in [`mcp-server/src/docs/upgrades/`](mcp-server/src/docs/upgrades/). Fetch a range with the MCP tool `terreno_get_upgrade_guide`. Format: [`mcp-server/src/docs/upgrades/README.md`](mcp-server/src/docs/upgrades/README.md). The [`58.0.0` stub](mcp-server/src/docs/upgrades/58.0.0.md) is for the next major (not yet a changelog section).

## [Unreleased]

Unreleased changes live in [`changelog/unreleased/`](changelog/unreleased/). Add one Markdown file per feature (see that directory's README) instead of editing this section.

## [57.2.0] - 2026-08-24

Upgrade note: [`mcp-server/src/docs/upgrades/57.2.0.md`](mcp-server/src/docs/upgrades/57.2.0.md).

### Breaking

- Lifecycle stage handoff YAML is now compact `v: 2` (`v`, `stage`, `status`, `next`,
  `action`; omit empty keys). Outer loops that parse `schema_version` / `recommended_next_stage`
  must switch keys. Chat and PRs keep the YAML in a Details toggle. Grow lists every grilled
  decision in an unbounded table after the 15-line index, or omits that table when there were
  none, and stays on a question until the answer is executable.

### Added

- Admin RBAC is now first-class: `admin:access` is the only permission that opens the admin
  page. Per-model access is `read` / `write` / `writeOwned` (with `isOwned` helpers and custom
  `authorize` callbacks). The shell hides models, custom screens, scripts, and Platform tools
  the caller cannot use; row update/delete follow per-record capabilities; roles use a
  one-select access level; denied forms are read-only.

### Changed

- Upgraded the toolchain to Bun 1.4. The GitHub Actions jobs that pinned an exact
  Bun version now use `1.4.0`, `@types/bun` and `bun-types` move to `^1.4.0`, and
  apps scaffolded by `@terreno/mcp` get `@types/bun@^1.4.0`. Contributors should
  run Bun 1.4 or newer locally. EAS build profiles keep their existing Bun pin:
  `eas.json` is an Expo fingerprint input, so bumping it would change the native
  runtime version and force a rebuild for a toolchain-only change.

## [57.1.0] - 2026-08-23

Upgrade note: [`mcp-server/src/docs/upgrades/57.1.0.md`](mcp-server/src/docs/upgrades/57.1.0.md).

### Added

- Admin configuration can now live beside `modelRouter` registrations or in plugin
  `adminContribution()` metadata. `@terreno/admin-frontend` adds a provider-backed widget registry,
  screen router, filter drawer, bulk actions, autocomplete references, and first-party Feature Flags,
  Consent, Documents, and AI admin integrations.
- `terreno_bootstrap_app` scaffolds Better Auth + `@terreno/syncdb` (replica-set MongoDB,
  `SyncApp`/`RealtimeApp`, `SyncDbProvider`) instead of JWT `generateAuthSlice`
- CircleCI dual-run for package CI, repo policies, and Playwright e2e (`.circleci/`;
  deploys still on GitHub Actions). See `docs/how-to/circleci.md`.
- `@terreno/comms` Phase 1 gap-fill: `beforeSend` mutate/cancel, `recordDeliveryEvent` /
  `recordOptOut`, attempt history on `CommsMessage`, payload retention
  (`retainPayloadDays`, `redactPayload`), and channel-wide transient retry (SMS,
  verification start, per-token push). `onRetry` stays `(context, result)` with
  `context.attempt`. Push prune honors `errorClass: "permanent"` as well as
  `isPermanentFailure`.
- `createCollectionHooks` in `@terreno/syncdb/react` and optional per-mutation
  `maxAttempts` on syncdb writes.
- Model Context Protocol support in `modelRouter` via an `mcp` option: opted-in
  models expose their CRUD operations as MCP tools at `POST /mcp`, reusing the
  same permissions, query filters, population, and lifecycle hooks as REST
  ([#358](https://github.com/FlourishHealth/terreno/pull/358)). `getMCPTools(user)`
  in `@terreno/ai` returns those tools as Vercel AI SDK objects for in-process
  chat. MCP list filters accept Mongo comparison operators (`$in`, `$gte`, `$ne`,
  and friends) and top-level `$and` / `$or` on `queryFields`; operators that can
  execute code (`$where`, `$expr`, `$function`) are rejected. `@terreno/rtk`
  adds `useMCPTools()` and `useTerrenoChat()`. MCP HTTP/stdio servers use the
  TypeScript SDK v2 (`2026-07-28`) with a how-to guide and structured tool-call
  logs. Lifecycle hooks and REST `responseHandler` receive a stub Express-shaped
  request from `createMCPRequest` (authenticated user, tool args as `body`, empty
  `headers`/`query`/`params`, `isMCPRequest: true`) rather than forwarded HTTP
  headers. `registerMCPTool` adds custom tools alongside modelRouter CRUD. The
  example backend exposes `users_todo_statuses` (admin-only: every user and their
  todo completed flags).
- Example app profiles list every assigned role and link superadmins to role editing. The admin
  script runner includes a guarded `resetDatabase` action, and seed data includes
  `superadmin@example.com`. The admin roles page supports creating and editing roles by selecting
  from the server's available permissions. Admin script execution requires `admin:runScripts` when
  RBAC is configured, and live production resets require `ALLOW_ADMIN_DB_RESET=true`.
- `SendGridMailProvider` at `@terreno/comms/adapters/sendgrid` (optional peer
  `@sendgrid/mail`) with sandbox mode, `errorCode`/`errorClass` taxonomy, Email Activity
  deep links, and one transient retry via `CommsService` hooks (`onError` / `onRetry` /
  `onSend`).
- `terreno-syncdb-codegen` CLI in `@terreno/syncdb` generates typed collection hooks
  (`store/syncDbSdk.ts`) from OpenAPI `x-terreno-sync` list operations. The CLI is a
  bin of `@terreno/syncdb`, not a separate `@terreno/syncdb-codegen` package.
- `@terreno/syncdb` documentation: reference (`docs/reference/syncdb.md`), migration guide
  (`docs/how-to/migrate-rtk-to-syncdb.md`), and local-first explainer
  (`docs/explanation/local-first-data.md`)

### Changed

- User admin forms now load existing RBAC roles into an **Add role** dropdown. Assigned roles
  remain visible and can be removed without entering raw array values. Blank optional enum
  fields no longer block otherwise valid saves, and role-update responses include the new roles.
- The admin sidebar groups Scripts, Roles, Version, Audit Log, Feature Flags, and Configuration
  under a consistently spaced **Platform** section at the bottom. Empty navigation sections are
  hidden, and Audit Log / Feature Flags no longer appear twice under Models.
- The Terreno planning plugin 2.0 is a fresh-invocation loop-engineering lifecycle:
  Grow → Pick → Roast → Brew → Taste. Every bounded stage discovers repository skills,
  reads/writes a shared evidence-oriented result/state contract, and exits. Brew no longer
  executes Taste; Taste reacts once to current CI/mergeability/review state while the outer
  loop owns waiting and reinvocation. Terreno package commands and domain rules remain in
  repo-local skills. Grow retains interactive grilling and a 15-line approval summary; Pick
  retains vertical-slice TDD and independent implementation/test-quality review; Roast is
  the authoritative verifier. The former Grind behavior remains an outer-loop feature
  profile, and static validation enforces names, transitions, portability, and loop bounds.
  Deprecated repo-local routers (`ip`, `implement`, `submit`, `autobot`, `check-watcher`)
  are removed. Quiet package tests (`test:agent`) run with `AGENT=1`. Brew, Taste, and
  repository PR skills now enforce an attention-budgeted GitHub format: only `Why`, `What
  changed`, and `Verification` remain visible; optional detail is expandable; comments are
  reserved for blocked decisions or non-obvious review resolutions.
- Unreleased notes are one file per feature in `changelog/unreleased/` instead of a shared
  `CHANGELOG.md` `## [Unreleased]` section. `docs/implementationPlans/PLAN_INDEX.md` is
  removed for the same reason — status lives on each IP's `**Status:**` header. Parallel
  PRs no longer conflict on those shared files.
- GitHub Actions package CI (API, AI, UI, RTK, comms, syncdb, examples, E2E, Maestro, admin SPA) now runs on `pull_request` with path filters, and on `push` only to `master`. This stops the first push of a new branch from ignoring path filters and running unrelated jobs (the 13 Playwright shards were the main cost). Docs-only and rules-only PRs skip package CI, Rulesync, CD, and frontend/demo deploy workflows. Example Frontend Deploy PR path filters match the frontend build gate (backend-only PRs skip the workflow; mixed PRs still retarget preview `BASE_URL`).
- CircleCI pipelines are disabled (`.circleci/config.yml` no-op). GitHub Actions
  remains the CI of record. Restore with `.circleci/config.setup.yml`. See
  `docs/how-to/circleci.md`.
- Lifecycle stages now follow a documentation contract: read architecture docs before
  acting, update them in the same slice, and fail user-visible or architectural work that
  ships without matching docs. All agent skills are installable with
  `npx skills add FlourishHealth/terreno`. The committed `skills/` tree is generated from
  `.rulesync/skills/`, the planning plugin stages, and `<package>/.ai/skills/` overlays via
  `bun run skills:sync`.
- Role assignment **preview** no longer writes `RbacAudit` denied-assign rows. Denied
  mutation audits are recorded only for the escalation `403` (`Cannot grant permissions
  you do not hold`); other failures are not stored as denials, and a failed audit write
  does not replace that original `403`.
- When a `PermissionSource` refresh fails with `staleOnFailure: "deny"` (the default),
  last-cached `deny` grants stay in force so IdP/ABAC restrictions do not lift. Additive
  `roles` / `permissions` from that source are still omitted.
- RBAC `createView: "deny"` and unknown field-view names fail closed instead of granting a
  full mask. Nested field omits clone documents; write masks honor dotted paths. Bulk create
  and array mutations apply the same write mask as single-document writes.
- AdminApp model CRUD requires resource actions in addition to `admin:access`. Self-service
  still cannot write User `admin`/`roles`. Without RBAC, admin CRUD may set `admin`.
  With RBAC, `roles` go through `RoleManager.assign`. Changing `admin` requires
  `rbac:assignRoles` plus an actor who already holds the legacy admin flag;
  `rbac:manageRoles` is not a substitute. Unchanged echoed `admin`
  values are allowed. If `assign` fails after an admin User update or bulk-patch,
  non-role fields are restored so the request does not keep a partial write.
  Role update requires the actor to hold the union of current and incoming
  permissions, and delete requires holding the role's current permissions, so
  `manageRoles` cannot empty or remove grants the actor lacks.
  assign/unassign require the actor to already hold the
  target user's current permissions. The seeded `auditor` role no longer receives
  `admin:access` via read-only expansion. Admin CRUD for a resource missing
  from statements fails closed for list/read, search, and writes. Framework statements now
  include `featureFlag`, `consentForm`, and `consentResponse` so superadmin `*`
  can list those admin models; example-backend adds `adminAuditLog` list/read.
  `POST /admin/background-tasks`
  requires `admin:runScripts`; version-config GET/PUT require `configuration:read` /
  `configuration:update`.
- MCP and SyncDB registries use resolved RBAC options (TerrenoApp-injected and the
  documented `access` + `accessControl` path, including pathless `modelRouter`)
  instead of the pre-build legacy permission arrays. Create/update also apply
  `validateAccessWritePayload` (field views / `createView: "deny"`).
  User `roles` on modelRouter writes (HTTP, sync, and MCP) are dropped when
  `accessControl` is set.
  Example-backend `backfillAdmins` is dry-run unless `RBAC_BACKFILL_ADMINS=true`.
- `runActionPermissions` combines legacy `action.permissions` with RBAC instead of replacing
  them. Actions without `access` inherit the router's `access.resource` and the mapped CRUD
  verb (`instance` POST → `update`, `collection` POST → `create`). Example todo
  `bulkComplete` / `markComplete` set `access: {resource: "todo", action: "update"}`
  so they cannot bypass `todo:update`. Empty action permissions and inherited CRUD actions
  mapped to `null` remain disabled. Assignment previews use uncached permission resolution
  on both the current and proposed sets, honor source `staleOnFailure` without writing
  caches, and reject role permissions the actor does not already hold. The admin role
  editor keeps Create/Save in the
  modal footer and scrolls the permission grid so a larger statement vocabulary cannot
  hide the save control. Create/list responses always apply the **read** field
  mask. Per-router `access.scope`
  extra PermissionSets are evaluated on HTTP and realtime reads. Sync and realtime
  serializers accept change-stream BSON post-images (no Mongoose `toObject`) so
  `sync:delta` is not dropped after RBAC wraps `defaultResponseHandler`. Invalid permission sets
  use a stable `APIError.title`.
- Self-service signup and `PATCH /auth/me` strip `organizationIds` alongside `admin` and `roles`,
  preventing callers from assigning themselves tenant membership. Administrative organization
  membership changes must use a privileged server-side path.
- Ordinary RBAC-enabled User modelRouter, sync, and MCP writes strip `admin`, `roles`, and
  `organizationIds`. AdminApp strips `organizationIds` the same way, and marks legacy
  `admin` writes only after `assignRoles` and an existing-admin check succeed.
- `RoleManager` writes `RbacAudit` (with `permissionDelta`) on create, update, remove, assign,
  and unassign. Denied escalation attempts are stored with `denied: true`. HTTP `rbacRouter`
  no longer writes a second audit row. Apps can pass `auditSink` (one function or an array)
  to fan records into a consuming-app log; set `persistAudit: false` to skip the built-in
  collection (at least one sink is then required).
- `RbacRole.seedDefaults` accepts `extraRoles` and shares `upsertSeededRole` with
  `RoleManager.seedDefaults`. `previewRoleChange` reports a real `affectedUserCount`.
- Importing `@terreno/api` no longer registers `RbacRole` / `RbacAudit` on the default
  mongoose connection. Use `createAccess({connection})` or `createRbacRoleModel` /
  `createRbacAuditModel`. The `RbacRoleModel` / `RbacAuditModel` singletons are removed;
  the `RbacRoleModel` type remains.
- The RBAC implementation plan is Complete (phases 1–6 shipped).

### Deprecated

- **`@terreno/rtk` for data synchronization** — deprecated as of **56.0.0**. Still published
  through the current major line; will not ship in the next major. Migrate collection CRUD to
  [`@terreno/syncdb`](docs/reference/syncdb.md) using
  [migrate-rtk-to-syncdb.md](docs/how-to/migrate-rtk-to-syncdb.md). Continue using `@terreno/rtk`
  for the OpenAPI SDK, Better Auth Redux, feature flags, and sockets.

### Fixed

- Admin lists no longer inherit public `queryFilter` scoping, and `adminFilter` Mongo operators
  are not rejected as client filters.
- Admin mutations and responses consistently scrub excluded fields, including populated refs.
- Plugin admin contributions forward `populatePaths`.
- Document Storage clients use the contributed `/documents` API path.
- Admin search applies the same `queryFilter`/`adminFilter` as list CRUD.
- AI Request Explorer multi-type filters use `$in` instead of dropping the filter.
- Admin list search (`q`) is a case-insensitive partial match across `searchFields`.
- The filter drawer can clear all filters and disables Apply when the draft is unchanged.
- Admin config `name` is unique when the same Mongoose model is mounted at more than one
  `routePath`, and list search/bulk-patch metadata is looked up by path.
- Document download failures log a status code only — not storage paths or provider payloads.
- The admin Roles screen scrolls its role cards and the "Available permissions" list instead
  of clipping them, and keeps the heading and "Add role" button pinned above the scroll area.
- `@terreno/ui` no longer triggers the react-native-web warning `"shadow*" style props are
  deprecated. Use "boxShadow".` — `Filter`, `WebDropdownMenu` (select fields, timezone picker,
  address field), and `DraggableList` now use `boxShadow`, and the new `createBoxShadow` /
  `applyColorOpacity` helpers build the shadow value from a color plus opacity.
- Patched `react-native-modalize` and `react-native-actions-sheet` to use `boxShadow` on
  iOS/web and `elevation` only on Android, so the two APIs do not stack. The modalize
  stylesheet ran at import time, so the deprecation warning appeared on every web page that
  imported `@terreno/ui`.
- Android centered dropdowns (`WebDropdownMenu` `presentation="centered"`) keep `elevation` and
  omit `boxShadow`, so the two APIs do not stack.
- Push hooks and retries are per-token; provider results are zipped to token strings
  after `beforeSend`. Mail payloads retain `replyTo` and `dynamicTemplateData`.
  `DeliveryEvent.errorClass` is persisted on the log row. `defaultFrom` is reapplied
  after `beforeSend`. Payload cleanup is best-effort and cannot fail `logSend` /
  `appendAttempt`. Hook exception text is logged only; `metadata.hookErrors` stores
  `hook-threw`, not `String(error)`.
- Conflict `requeue` copies per-mutation `maxAttempts` onto the cloned outbox
  row so `retries: false` stays fail-fast after keepMine.
- Expo native fingerprints for the demo and example frontend now exclude `package.json`
  scripts. Development and test command changes no longer trigger unnecessary native build
  acknowledgements or rebuilds.
- MCP create/update apply REST `validation.excludeFromCreate` /
  `excludeFromUpdate` and MCP `excludeFields` as a write denylist on persist and
  hook request bodies, including nested/dot paths and literal dotted keys
  (`"metadata.nested.token"`). Invalid ObjectIds return a structured not-found
  instead of crashing on `CastError`; mixed-case 24-hex ids still work. List
  returns a structured error when `queryFilter` throws. A throwing
  `responseHandler` / `mcpResponseHandler` becomes a structured tool error instead
  of a protocol crash. List filters ignore queryFields that sit under an
  `excludeFields` parent path, matching tool schema generation. Lifecycle hooks
  that throw `APIError` return `error.title` to the MCP client, matching
  `queryFilter` handling.
- `@terreno/ui` no longer triggers the React Native Web warning
  `props.pointerEvents is deprecated. Use style.pointerEvents`. Every component that set
  `pointerEvents` as a prop (`DateTimeField`, `Filter`, `SidebarNavigation`, `ToastNotifications`,
  `WebDropdownMenu`) now sets it in `style`.
- The `react-native-portalize` dependency, which set the deprecated prop on every screen through
  `TerrenoProvider`, is replaced by an internal portal host. `Host` and `Portal` are now exported
  from `@terreno/ui` with the same API.
- `seedDefaults` no longer overwrites customized unsealed roles on restart; sealed defaults still refresh from code.
  API tests clear `RbacRole` / `RbacAudit` in `setupDb` so leftover unsealed names cannot leak across cases.
- Admin `/bulk-patch` authorizes each target document, so scoped `update` cannot patch out-of-scope ids.
- Admin User CRUD can set the `admin` flag when RBAC is off. With RBAC, changing `admin` requires `rbac:assignRoles`; echoed unchanged `admin` values on create/update do not.
- Permission resolver caches evict expired and overflow entries so distinct identities cannot grow unbounded.
- Clearing a role description in the admin UI sends `null` so PATCH removes the field.
- Admin User create rolls back the new row if `RoleManager.assign` fails after insert.
- `assign` / `unassign` refuse to change a user whose current permissions the actor does not hold.
- MCP model tools pick up TerrenoApp-injected `accessControl` (permissions, query filters, write masks) instead of keeping the pre-build legacy checks.
- Example todos Sync Lab panel starts collapsed so the first list row stays
  above the tab bar on short web viewports.
- `terreno-syncdb-codegen` rejects non-identifier collection/type names and
  JSON-escapes generated strings so a remote OpenAPI document cannot inject
  TypeScript.
- `@terreno/syncdb` no longer misses server changes that land between its startup snapshot
  and the socket joining a stream's room: each `sync:subscribed` confirmation now pages the
  streams it names from their cursor, instead of leaving the client stale until the next
  periodic reconcile

## [57.0.0] - 2026-08-20

Upgrade note: [`mcp-server/src/docs/upgrades/57.0.0.md`](mcp-server/src/docs/upgrades/57.0.0.md).

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

Upgrade note: [`mcp-server/src/docs/upgrades/57.0.0-beta.1.md`](mcp-server/src/docs/upgrades/57.0.0-beta.1.md).

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

Upgrade note: [`mcp-server/src/docs/upgrades/56.0.0-beta.2.md`](mcp-server/src/docs/upgrades/56.0.0-beta.2.md).

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

Upgrade note: [`mcp-server/src/docs/upgrades/0.31.0.md`](mcp-server/src/docs/upgrades/0.31.0.md).

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

Upgrade note: [`mcp-server/src/docs/upgrades/0.30.0.md`](mcp-server/src/docs/upgrades/0.30.0.md) (consolidated 0.21.0 → 0.30.0).

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

Upgrade note: [`mcp-server/src/docs/upgrades/0.21.0.md`](mcp-server/src/docs/upgrades/0.21.0.md).

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

Upgrade note: [`mcp-server/src/docs/upgrades/0.20.0.md`](mcp-server/src/docs/upgrades/0.20.0.md).

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
