# Implementation Plan: App MCP — Laravel MCP parity

**Status:** Draft  
**Created:** 2026-08-24  
**Owner:** unassigned  
**Depends on:** [model-router-mcp.md](model-router-mcp.md) (shipped), [mcp-boost-parity.md](mcp-boost-parity.md) (dev-time MCP — sibling, not a blocker)  
**Roadmap issue:** TBD after Approve (`roadmap-item`)

Follow-up to the Boost IP. Boost is Laravel **Boost** (agents writing Terreno). This plan is Laravel **MCP** (`laravel/mcp`): the **running app** as an MCP server that ChatGPT, Claude, Cursor, and in-app agents can call.

Source compared: [Laravel 13 MCP](https://laravel.com/docs/13.x/mcp).

## Goal

A Terreno backend can expose the same MCP *product* surface Laravel documents — tools, prompts, resources, named HTTP servers, Inspector/test DX, and a first-party client — without giving up generated CRUD tools that stay aligned with `modelRouter` permissions.

When this is done, an operator can:

1. Keep `mcp: { methods: ["list", "read"] }` on `modelRouter` (already shipped).
2. Register a custom tool / prompt / resource with the same auth user as REST.
3. Optionally mount a second server at `/mcp/admin` (or similar) with a subset of primitives.
4. Hit the endpoint with MCP Inspector and assert tool calls in Bun tests without speaking JSON-RPC by hand.
5. Use `@terreno/ai` `MCPService` over Streamable HTTP (the transport `/mcp` already speaks).

## Non-goals

| Out | Why |
| --- | --- |
| Hosted `@terreno/mcp` / `terreno-mcp-local` codegen, docs search, CDP logs | Boost IP |
| OAuth 2.1 / RFC 9728 for app `/mcp` | Same bearer as REST (JWT + Better Auth). OAuth for privileged ops is [infra-mcp.md](infra-mcp.md) |
| MCP Apps (`ui://` HTML iframes, Blade-like MCP UI) | Spec still moving; no Terreno UI host |
| PHP class inheritance, Laravel container, Artisan `make:mcp-*` as PHP | TS factories + optional hosted codegen tools |
| stdio transport for **app** MCP | Product path is HTTP; local stdio is the Boost companion |
| Streaming/progress generators, resource subscriptions | Defer |
| Changing generated CRUD tool names or default read-only methods | Compat |

## Why this is a separate IP

| Layer | Laravel | Terreno today |
| --- | --- | --- |
| Dev-time (“teach the agent the framework”) | Boost | `@terreno/mcp` + Boost IP |
| Runtime (“the app *is* an MCP server”) | `laravel/mcp` | `modelRouter` `mcp` + `registerMCPTool` on `POST /mcp` |

[model-router-mcp.md](model-router-mcp.md) explicitly deferred resources/prompts. Laravel MCP’s value is the **primitive kit** around CRUD, not CRUD itself. Terreno already wins on “one `mcp:` block ⇒ permissioned tools.” We are behind on everything else in that kit.

## Current code (leaves)

| Seam | Behavior |
| --- | --- |
| `api/src/mcp/server.ts` `mountMCPServer` | Stateless `createMcpHandler`, `POST /mcp`, tools capability only |
| `api/src/mcp/toolGenerator.ts` | `{prefix}_{list,read,create,update,delete}` from registry |
| `api/src/mcp/registry.ts` `registerMCPTool` | Custom tools: `name`, `description`, `zodSchema`, `handler` |
| Auth | `extractUserFromHeaders` — JWT or Better Auth; permissions reuse REST |
| `@terreno/ai` `MCPService` | **SSE** client only — mismatch with Streamable HTTP server |
| `@terreno/rtk` `useMCPTools` | Official MCP client, Streamable HTTP to `/mcp` |
| Tests | Registry/handler/integration tests; no Inspector helper, no prompt/resource tests |

## Decisions (Grow defaults)

Recorded so Pick does not re-litigate. Change on Approve if wrong.

| ID | Question | Choice |
| --- | --- | --- |
| Q1 | Scope vs Boost | **App MCP only.** No hosted/local codegen tools except optional generators *of* app primitives (Phase 3). |
| Q2 | Primitive shape | **Factories**, not PHP-style classes: `defineMCPTool` / `defineMCPPrompt` / `defineMCPResource` wrapping `registerMCP*`. |
| Q3 | Default endpoint | **Keep `/mcp`.** Additive capabilities. No rename. |
| Q4 | Multiple servers | **Yes, v1.** Named mounts with explicit include lists. Default `/mcp` remains the union of CRUD + globally registered primitives (today’s behavior). Extra servers are opt-in and do not auto-include every model tool. |
| Q5 | Auth | **Bearer only** (existing). Per-server `allowAnonymous` matches `modelRouter`. No Passport/OAuth in this IP. |
| Q6 | Tool metadata | **Annotations + optional `outputSchema` + `structuredContent`.** Map Laravel `IsReadOnly` / `IsDestructive` / `IsIdempotent` / `IsOpenWorld`. |
| Q7 | Conditional register | **`shouldRegister(user)`** (and optional `shouldRegister: false`) on tools/prompts/resources. Filter `tools/list` and reject `tools/call` if hidden. |
| Q8 | Response helper | **`mcpResult.text` / `.json` / `.error`** so handlers are not hand-rolled `{content:[{type:"text"}]}`. Images/audio out. |
| Q9 | Client | **Upgrade `MCPService` to Streamable HTTP**; add list/get prompts and list/read resources. Named clients stay a `Record` keyed by name (already). |
| Q10 | OAuth / MCP Apps / streaming | **Out.** Listed under Future work. |
| Q11 | Test DX | **`invokeMCPTool` / `invokeMCPPrompt` / `readMCPResource`** against an in-process Express app (supertest JSON-RPC or SDK client). Document MCP Inspector; do not vendor Inspector. |
| Q12 | Codegen on Boost MCP | **Phase 3 optional:** `terreno_generate_mcp_tool` (and prompt/resource) on `@terreno/mcp` that emits factory snippets. Not a blocker for Phases 1–2. |

## Architecture

```
MCP client (Inspector, Claude, ChatGPT, useMCPTools, MCPService)
        │  Authorization: Bearer <jwt|better-auth>
        ▼
 POST /mcp              ← default union (CRUD + global registerMCP*)
 POST /mcp/:serverName  ← optional named server (explicit primitives)
        │
        ├─ tools     (generated CRUD + defineMCPTool)
        ├─ prompts   (defineMCPPrompt)     NEW
        └─ resources (defineMCPResource)   NEW
              │
              ▼
     same User as REST → permissions / queryFilter / hooks
```

### Public API (target)

```typescript
import {
  defineMCPPrompt,
  defineMCPResource,
  defineMCPTool,
  mcpResult,
  mountMCPServer,
} from "@terreno/api";
import {z} from "zod";

defineMCPTool({
  name: "weather_current",
  description: "Current forecast for a city.",
  annotations: {readOnlyHint: true, openWorldHint: true},
  zodSchema: z.object({city: z.string()}),
  outputSchema: z.object({tempC: z.number(), summary: z.string()}),
  shouldRegister: (user) => Boolean(user),
  handler: async ({city}, user) => {
    return mcpResult.json({tempC: 22, summary: `Clear in ${city}`});
  },
});

defineMCPPrompt({
  name: "weather_briefing",
  description: "Ask the model to summarize weather for a user.",
  arguments: [{name: "city", required: true, description: "City name"}],
  handler: async ({city}) => ({
    messages: [{role: "user", content: {type: "text", text: `Brief the weather in ${city}.`}}],
  }),
});

defineMCPResource({
  uri: "weather://guidelines",
  name: "weather_guidelines",
  mimeType: "text/markdown",
  handler: async () => mcpResult.text("# Use metric units."),
});

// Optional second server — does not receive modelRouter CRUD unless listed
mountMCPServer(expressApp, {
  path: "/mcp/weather",
  name: "weather",
  instructions: "Weather tools only.",
  tools: ["weather_current"],
  prompts: ["weather_briefing"],
  resources: ["weather://guidelines"],
});
```

`defineMCP*` is sugar over `registerMCP*` (same registry). Existing `registerMCPTool` calls keep working.

`TerrenoApp` continues to auto-mount `/mcp` when the registry is non-empty. Named extra servers are registered via `app.mcpServer({path, ...})` or `mountMCPServer` in `configureApp`.

CRUD tools get annotations: list/read `readOnlyHint: true`; create/update `idempotentHint: false`; delete `destructiveHint: true`.

### Client (`@terreno/ai`)

`MCPService` transport becomes Streamable HTTP (SDK `StreamableHTTPClientTransport` or AI SDK equivalent). Keep SSE as an explicit `transport: "sse"` for old servers. Add `listPrompts` / `getPrompt` / `listResources` / `readResource`. `getMCPTools` (in-process) includes custom tools unchanged; prompts/resources stay MCP-protocol-only unless a later IP asks for in-process prompt runners.

### Testing

```typescript
const res = await invokeMCPTool(app, {
  name: "weather_current",
  arguments: {city: "Austin"},
  user: adminUser,
});
expect(res.isError).toBe(false);
```

Helper authenticates as `user`, POSTs `tools/call` (or uses SDK), returns parsed result. Mirror Laravel `WeatherServer::tool(...)->assertOk()`.

## Docs (same slice as code — Pick)

| Diátaxis | Page |
| --- | --- |
| Explanation | `docs/explanation/app-mcp.md` — two MCP layers (Boost vs app), why CRUD is generated, why Laravel-style primitives are registered |
| How-to | Expand `docs/how-to/expose-mcp-tools.md`; add `docs/how-to/add-mcp-prompts-and-resources.md`; add Inspector section |
| Reference | `docs/reference/api.md` MCP section: factories, annotations, named servers, env none |
| Example | `example-backend` registers one prompt + resource + annotated custom tool; README snippet |

`update-docs` on every phase that changes public API. `mcp-server` resource markdown that documents app MCP must match (Boost corpus).

## Phases

### Phase 1 — Prompts, resources, richer tools on `/mcp`

Tracer: example-backend custom tool already exists (`users_todo_statuses`). Add one prompt + one resource; Inspector `prompts/list` and `resources/list` succeed with a bearer token.

- Registry for prompts/resources; `shouldRegister`; annotations; `outputSchema` / structured content when SDK supports it; `mcpResult`.
- `mountMCPServer` advertises `prompts` and `resources` capabilities. **Mount `/mcp` when any primitive exists**, not only when `getAllMCPTools().length > 0` (today the server is skipped if there are no tools).
- Tests: list/call/get/read; hidden primitive absent from list and rejected on call; CRUD tools still work.

### Phase 2 — Named HTTP servers

- `mountMCPServer(app, {path, name, instructions, tools?, prompts?, resources?})`.
- Default `/mcp` union unchanged when extra servers exist.
- Empty include list on a named server ⇒ that primitive kind empty (no surprise CRUD leak).
- Tests: tool on `/mcp` not listed on `/mcp/weather` unless included.

### Phase 3 — Factories + optional Boost generators

- Export `defineMCPTool|Prompt|Resource`.
- Example-backend uses `defineMCP*` for the tracer primitives.
- Optional: hosted MCP `terreno_generate_mcp_tool` emitting the factory snippet (Boost package). Skip if Phase 1–2 slip; do not block.

### Phase 4 — Inspector + `invokeMCP*`

- Test helpers in `api/src/mcp/testHelpers.ts` (or `api/src/tests/` if that is the existing helper home).
- How-to: `bunx @modelcontextprotocol/inspector` against example-backend `/mcp`.
- Laravel-style assertions: `isError`, text contains, structured JSON.

### Phase 5 — `MCPService` Streamable HTTP + prompts/resources

- Default HTTP transport matches server.
- Tests with a mock Streamable HTTP server or example-backend.
- `useMCPTools` already HTTP — no change unless headers break.

## Notifications

None.

## UI

No new screens. Example-frontend chat already uses MCP tools; optional follow-up to surface prompt names is out of scope.

## Feature flags & migrations

None. Additive APIs. `registerMCPTool` signature may gain optional fields only.

## Risks

| Risk | Mitigation |
| --- | --- |
| MCP SDK prompt/resource APIs differ by SDK version | Pin to the SDK `createMcpHandler` already uses; wrap in `api/src/mcp/` |
| Tool list cardinality explodes with CRUD × models × extras | Named servers + `shouldRegister`; docs tell operators to split |
| `MCPService` SSE clients in the wild | Keep `transport: "sse"`; default new HTTP |
| Structured output clients ignore `outputSchema` | Always include text content (Laravel compatibility pattern) |

## Future work (not this IP)

- OAuth 2.1 for ChatGPT connectors that refuse raw bearer tokens
- MCP Apps / `ui://` HTML
- Resource templates (`weather://forecast/{city}`) if SDK templates are stable
- Progress notifications / streaming tool handlers
- Rate limiting (already deferred on model-router-mcp)

## Files to create / modify (expected)

| Area | Files |
| --- | --- |
| API | `api/src/mcp/registry.ts`, `server.ts`, `toolGenerator.ts`, `types.ts`, new `prompts.ts` / `resources.ts` / `result.ts` / `testHelpers.ts` + tests |
| App | `api/src/terrenoApp.ts`, `api/src/index.ts` |
| AI | `ai/src/service/mcpService.ts` + tests |
| Example | `example-backend` MCP module + README |
| Docs | explanation + how-to + `docs/reference/api.md`; Boost IP / model-router-mcp cross-links |
| Optional | `mcp-server/src/tools.ts` generators |

## Task list

[`docs/tasks/app-mcp-laravel-parity.md`](../tasks/app-mcp-laravel-parity.md)

## Acceptance criteria

- [ ] `prompts/list` and `resources/list` work on `/mcp` when primitives are registered
- [ ] `shouldRegister: false` hides the primitive from list and call
- [ ] CRUD tools keep REST permission behavior
- [ ] A named server at a second path exposes only its include list
- [ ] `invokeMCPTool` can assert a successful custom tool in Bun tests
- [ ] `MCPService` can list tools over Streamable HTTP against `mountMCPServer`
- [ ] Docs: explanation of two MCP layers; how-to for prompts/resources + Inspector; reference for factories and named servers
- [ ] `registerMCPTool` without new fields still typechecks and runs
