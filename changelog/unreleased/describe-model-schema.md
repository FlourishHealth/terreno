---
category: Added
---

`describeModel()` and `describeModelForRouter()` in `@terreno/api` walk Mongoose schemas once and expose a canonical `ModelDescription` field graph. OpenAPI (`getOpenApiSpecForModel`), admin `/admin/config` field metadata, and MCP Zod tool schemas now format that graph instead of independently walking `schema.paths` or mongoose-to-swagger. Map fields take their value kind from Mongoose `of` / `getEmbeddedSchemaType()` (not a date fallback).

Exports include `modelDescriptionToOpenApiSpec`, `modelDescriptionToAdminFields`, and `fieldDescriptionToZodType`. See `docs/explanation/schema-metadata.md`.
