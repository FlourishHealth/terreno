# Changelog

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
