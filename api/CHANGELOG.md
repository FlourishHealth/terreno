# Changelog

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
