---
category: Added
---

- Model Context Protocol support in `modelRouter` via an `mcp` option: opted-in
  models expose their CRUD operations as MCP tools at `POST /mcp`, reusing the
  same permissions, query filters, population, and lifecycle hooks as REST
  ([#358](https://github.com/FlourishHealth/terreno/pull/358))
- `getMCPTools(user)` in `@terreno/ai` returns registered modelRouter MCP tools
  as Vercel AI SDK tool objects for in-process use from a chat route
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
