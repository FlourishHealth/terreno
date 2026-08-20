# Reference

Technical reference for Terreno packages and APIs. Information-oriented, precise descriptions.

## Packages

- [@terreno/api](api.md) — modelRouter, auth, permissions, setupServer
- [@terreno/ui](ui.md) — Components, theming, layout
- [@terreno/rtk](rtk.md) — Auth slice, SDK codegen, token handling
- [@terreno/syncdb](syncdb.md) — Local-first data layer (reads, writes, offline sync)
- [@terreno/ai](ai.md) — AI service, GPT routes, Langfuse integration
- [@terreno/admin-backend](admin-backend.md) — Auto-generated admin CRUD endpoints
- [@terreno/admin-frontend](admin-frontend.md) — Admin panel UI components
- [@terreno/admin-spa](admin-spa.md) — Standalone admin SPA + Express serve plugin
- [@terreno/api-health](api-health.md) — Health check TerrenoPlugin
- [@terreno/comms](comms.md) — Pluggable mail, SMS, push, and verification providers
- [@terreno/feature-flags](feature-flags.md) — Feature flags and A/B testing plugin
- [@terreno/mcp](mcp-server.md) — AI coding assistant integration (MCP)
- [@terreno/test](test.md) — Bun test helpers and in-memory MongoDB

## Configuration

- [Environment Variables](environment-variables.md) — Complete environment variable reference for all packages

## Other references

- Root [package.json](https://github.com/flourishhealth/terreno/blob/master/package.json) — Workspace scripts and catalog
- Per-package `package.json` in each package directory — Commands and dependencies
