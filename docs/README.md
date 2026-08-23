# Terreno Documentation

Documentation for the Terreno monorepo: shared packages for full-stack applications with React Native and Express/Mongoose.

## Structure

- **[Tutorials](tutorials/)** — Learning-oriented, hands-on lessons
- **[How-to guides](how-to/)** — Problem-oriented, practical steps
- **[Reference](reference/)** — Technical reference for APIs and packages
- **[Explanation](explanation/)** — Concepts and context
- **[Implementation Plans](implementationPlans/)** — Forward-looking plans for major features

## Packages

| Package | Description |
|---------|-------------|
| [@terreno/api](reference/api.md) | REST API framework (Express/Mongoose) |
| [@terreno/ui](reference/ui.md) | React Native UI component library |
| [@terreno/syncdb](reference/syncdb.md) | Local-first data layer (offline sync, conflicts) |
| [@terreno/ai](reference/ai.md) | AI service, GPT routes, request logging |
| [@terreno/admin-backend](reference/admin-backend.md) | Admin panel backend plugin |
| [@terreno/admin-frontend](reference/admin-frontend.md) | Admin panel frontend screens |
| [@terreno/admin-spa](reference/admin-spa.md) | Standalone admin SPA + Express serve plugin |
| [@terreno/api-health](reference/api-health.md) | Health check endpoint plugin |
| [@terreno/comms](reference/comms.md) | Pluggable communications providers |
| [@terreno/feature-flags](reference/feature-flags.md) | Feature flags and A/B testing plugin |
| [@terreno/mcp](reference/mcp-server.md) | AI coding assistant integration (MCP) |
| [@terreno/cli](reference/cli.md) | `terreno` CLI for docs, codegen, bootstrap, and OpenAPI REST |
| [@terreno/test](reference/test.md) | Bun test helpers and in-memory MongoDB |

### Legacy

| Package | Description |
|---------|-------------|
| [@terreno/rtk](reference/legacy/rtk.md) (deprecated) | RTK Query utilities — superseded by syncdb for data sync; still used for OpenAPI SDK, auth, and feature flags during migration |

**Migrating from RTK?** See [How to migrate from @terreno/rtk to @terreno/syncdb](how-to/migrate-rtk-to-syncdb.md).

## Quick links

- [Getting started](tutorials/getting-started.md)
- [Local-first data](explanation/local-first-data.md)
- [AGENTS.md](../AGENTS.md) — Onboarding context for AI assistants
- [ROADMAP.md](../ROADMAP.md) — Public roadmap
