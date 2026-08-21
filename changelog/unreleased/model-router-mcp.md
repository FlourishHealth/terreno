---
category: Added
---

Model Context Protocol support in `modelRouter` via an `mcp` option: opted-in
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
