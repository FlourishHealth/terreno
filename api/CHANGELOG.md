# Changelog

## 0.29.1

Patch release for `@terreno/api` 0.28.0's `APIError` rework. In 0.28.0 `Error.message` became exactly
`title`, so anywhere the framework re-wrapped an inner error and rebuilt the wrapper's text with
`errorMessage(inner)`, the inner error's `detail`, `code`, `meta`, `fields`, and `status` were
silently dropped. This release makes `modelRouter` pass those errors through instead.

### Fixed

- **`modelRouter` no longer re-wraps an `APIError` raised inside your code.** Every catch that used
  to build a generic wrapper now re-throws an `APIError` untouched, so its `status`, `title`,
  `detail`, `code`, and `meta` reach the client. This covers `model.create()`, the create/update
  `doc.save()`, populate-after-create, `postCreate`, `postUpdate`, `postDelete`, `queryFilter`, the
  list query, list serialization, `doc.deleteOne()`, every `responseHandler` call, and the
  `preUpdate` / `doc.save()` / `postUpdate` steps of the array-operation `PATCH` helper. Previously
  only the `transform`, `preCreate`, `preUpdate`, and `preDelete` catches had the guard. The most
  common casualty was an `APIError` thrown from Mongoose document middleware (`pre("save")`,
  `pre("validate")`), which reached the client as `{status: 400, title: "Create error", code:
  "create-error"}` with the consumer's `code` and `meta` gone.
- **Mongoose validation and cast errors from `modelRouter` writes now carry per-field messages
  again.** The `model.create()` and `doc.save()` catches run `mongooseErrorToAPIError` before falling
  back to a generic wrapper, so a `ValidationError` surfaces as
  `{status: 400, title: "Validation failed", meta: {fields: {...}}}` rather than
  `{title: "Create error", detail: "Validation failed: name: Path \`name\` is required."}`. These
  errors are also marked `disableExternalErrorTracking`, so bad client input stops paging Sentry.
- **`queryFilter` wrapper details are readable.** That catch used `String(error)`, which emitted
  `"Error: <message>"` for an `Error` and `"[object Object]"` for a thrown non-`Error`. It now uses
  the same message extraction as every other catch.
- **Framework-thrown errors follow the 0.28.0 contract.** `api.ts`, `plugins.ts`, `actions.ts`, and
  `docLoader.ts` no longer interpolate per-occurrence values into `title`; the specific text moved to
  `detail` (plus `meta` / `source` where it is structured), and each error carries a kebab-case
  `code` and, where applicable, a status subclass (`BadRequestError`, `ForbiddenError`,
  `NotFoundError`, `ValidationError`, `InternalServerError`). Titles are now stable strings, so
  Sentry groups them by logical error instead of by occurrence.
- **`findOneOrNone`, `findOneOrNoneFor`, and `findExactlyOne` accept `Partial<APIErrorOptions>`** for
  `errorArgs` instead of the deprecated `Partial<APIErrorConstructor>`. `errorArgs` is still applied
  last, so every field including `status` remains overridable.

### Added

- **`errorDetail(error)`** — returns `` `${title}: ${detail}` `` for an `APIError` and
  `errorMessage(error)` for anything else. Used for the `detail` of framework wrapper errors so a
  nested `APIError`'s text is never lost if one does reach a wrapper.

### Changed (behavior)

- **`apiUnauthorizedMiddleware` only matches a plain `Error("Unauthorized")`.** It is registered
  ahead of `apiErrorMiddleware`, and because `message` is now exactly `title`, it was rewriting **any**
  `APIError` titled `"Unauthorized"` into a bare 401 and discarding its status, `code`, and `detail`.
  A `new ForbiddenError({title: "Unauthorized"})` now stays a **403** with its own body; Passport's
  plain `Error("Unauthorized")` still becomes a quiet 401.
- **An `APIError` thrown from a hook or from Mongoose middleware now returns its own status.**
  Previously the wrapper's hardcoded status (usually 400, or 403 for `transform`/`preDelete`) won.
  If you throw a non-4xx `APIError` from `postCreate`, `postUpdate`, `postDelete`, `queryFilter`,
  `responseHandler`, or a `pre("save")` hook, clients now see that status instead of 400.
- **Framework error titles changed** where they used to embed per-occurrence values. The old text is
  preserved in `detail`. Notable renames: `` `${param} is not allowed as a query param.` `` →
  `"Query parameter not allowed"`; `` `Invalid page: ${page}` `` → `"Invalid page"`;
  `` `Invalid date for query parameter ${key}` `` → `"Invalid date query parameter"`;
  `` `Could not find ${field}/${itemId}` `` → `"Array item not found"`;
  `` `Could not find document to PATCH: ${id}` `` → `"Document not found"`;
  `` `Malformed body, array operations…` `` → `"Malformed array operation body"`;
  `` `Invalid array operation: ${op}` `` → `"Invalid array operation"`;
  `` `Patch not allowed for user…` `` → `"Update not allowed"`;
  `` `Access to ${method} on ${model}…denied` `` → `"Access denied"` (both `modelRouter` array
  operations and `runActionPermissions`); and the `plugins.ts` query statics now use
  `"findExactlyOne query returned no documents"`, `"findExactlyOne query returned multiple
  documents"`, `"findOne query returned multiple documents"`, and `"upsert find query returned
  multiple documents"` with the model name in `detail`/`meta`. Clients that string-match on `title`
  should match on `code` instead.
- **A Mongoose validation failure on an array-operation `PATCH` returns `"Validation failed"`** with
  `meta.fields` rather than `"PATCH Pre Update error"`.

### Unchanged

No HTTP statuses were changed. The 405 that `runActionPermissions` returns when a pre-document
permission check fails is kept as-is: `modelRouter`'s array operations return 405 for the same check,
so it is an existing (if odd) convention rather than a typo to fix in a patch release.

## 0.20.0

### Changed (breaking)

- **`ConfigurationApp` `POST {basePath}/list-secrets` no longer persists secret values.** Previously it resolved secrets from the provider and wrote the resolved plaintext values into the configuration document. It is now a **read-only validation/status** endpoint: it reports, per secret field, only non-sensitive metadata (`path`, `secretName`, `version`, and a boolean `resolvable`/`isConfigured`) and never writes to the document or returns secret values. A `POST {basePath}/validate-secrets` alias with the same behavior is also registered.
- **`ConfigurationApp` `PATCH {basePath}` strips `secret: true` fields** from the incoming body, so a secret value can never be written through the update path. Secret fields are read-only via this surface.
- **`configurationPlugin` no longer adds the `_singleton` unique index by default.** It is now opt-in via `enforceSingletonIndex: true` so it does not double-enforce or conflict with consumers that already guarantee a single non-deleted document via the pre-save guard or their own soft-delete plugin/indexes.
- **`configurationPlugin` singleton semantics are now soft-delete aware.** `getConfig`, `updateConfig`, and the pre-save guard operate on `{deleted: false}` when the schema has a `deleted` path (e.g. via `isDeletedPlugin`). A soft-deleted document no longer blocks creating a new singleton; hard deletes (`deleteOne`/`deleteMany`/`findOneAndDelete`) remain blocked.
- **`configurationPlugin.updateConfig` now applies updates via `findOneAndUpdate({$set})` with dotted paths** instead of `Object.assign` + `doc.save()`. This preserves sibling fields inside nested subdocuments on partial patches and tolerates legacy/out-of-schema fields already persisted under `strict: "throw"`.

### Added

- **`SecretProvider.getSecret(secretName, version?)`** — optional `version` parameter. `GcpSecretProvider` resolves `projects/{projectId}/secrets/{name}/versions/{version}` (default `latest`, full resource paths still honored); `EnvSecretProvider` ignores it. Secret fields can declare a `secretVersion` schema option, surfaced on `SecretFieldMeta.version` and passed through `resolveSecrets`.
- **`CompositeSecretProvider`** — composes an ordered list of providers and returns the first non-null result; a failing provider is warn-logged (secret name only) and resolution falls through to the next.
- **`CachingSecretProvider`** — wraps any provider with an in-memory TTL cache keyed by `secretName@version`, with `clear()` / `clearKey()` for rotation and tests. Caches `null` results. Never logs values.
- **`ConfigurationApp` pluggable permissions** — `permissions: {read?, update?, meta?, listSecrets?}` accepts terreno permission functions (e.g. `[IsStaff]`), AND-combined like `modelRouter`. Defaults to admin-only for every route.
- **`ConfigurationApp` lifecycle hooks** — `preUpdate(body, req)` (validate/normalize) and `postUpdate(config, prevValue, req)` (audit logging). Both payloads have secret values redacted.
- **`flattenToDotPaths`** — exported helper used by `updateConfig`.

### Migration

- If you relied on `list-secrets` to populate secret values into the configuration document, stop. Resolve secrets on-demand at runtime via `Model.resolveSecrets(provider)` (returns an in-memory `Map`) and read them from memory; never persist them.
- If you depended on the `_singleton` unique index, pass `configurationPlugin(schema, {enforceSingletonIndex: true})`.
- For GCP-with-env-fallback and caching, compose `new CachingSecretProvider(new CompositeSecretProvider([gcp, env]), {ttlMs})`.

## 0.16.0

### Added

- **modelRouter actions** — Declare `instanceActions` and `collectionActions` on `ModelRouterOptions` for named operations at `/resource/:id/action` and `/resource/action`. Handlers receive `{req, res, user, doc?, body, query}`; return values are wrapped in `{data: ...}`. OpenAPI operations are emitted automatically when `openApi` is configured.
- **`loadDocOr404`** — Shared document loader used by permission middleware and instance actions (soft-delete-aware 404 metadata preserved).

### Changed

- Permission middleware doc loading now delegates to `loadDocOr404` (behavior-preserving).

### Dependencies

- Added `@asteasolutions/zod-to-openapi` ^8.5.0 (direct dependency).
- Added **`zod` ^4.3.6 as a peer dependency** — backends that define action Zod schemas must install `zod`.

### Migration

- Regenerate frontend SDKs after adding actions; `operationId` values follow `{tag}_{actionName}` (e.g. `todos_markComplete`).
