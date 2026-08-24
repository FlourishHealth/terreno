# Tasks: App MCP — Laravel MCP parity

See: [`docs/implementationPlans/app-mcp-laravel-parity.md`](../implementationPlans/app-mcp-laravel-parity.md)

**Status:** Draft (Grow). Do not Pick until the IP header is **Approved**.

## Instructions for the implementing agent

- Load `update-docs`, `terreno-backend-api`, `backend-test-env`. For `MCPService` / RTK hooks also `terreno-data-fetching`.
- TDD: failing test for the primitive, then implementation.
- Do not change hosted Boost tools except optional Phase 3 generators.
- Do not add OAuth or MCP Apps.
- After API export changes, update `docs/reference/api.md` and `docs/how-to/expose-mcp-tools.md` in the same task.
- Run focused `bun test` in `api/` (and `ai/` for Phase 5). `bun run lint` on touched packages.

---

### Phase 1: Prompts, resources, richer tools

- [ ] **Task 1.1**: MCP result helper + richer custom tool types
  - Delivers: `mcpResult.text` / `.json` / `.error`; optional `annotations`, `outputSchema`, `shouldRegister` on `registerMCPTool` without breaking existing callers
  - Files: `api/src/mcp/result.ts`, `api/src/mcp/result.test.ts`, `api/src/mcp/types.ts`, `api/src/mcp/registry.ts`, `api/src/mcp/registry.test.ts`, `api/src/index.ts`
  - Blocked by: none
  - Docs: `docs/reference/api.md` (custom tool options table)
  - Skills: `terreno-backend-api`, `update-docs`
  - Acceptance: existing `registerMCPTool` tests pass; new test covers `shouldRegister` returning false omits the tool from `getAllMCPTools` for that user; `mcpResult.json` returns text JSON plus `structuredContent` when the SDK result type allows it

- [ ] **Task 1.2**: Register and serve prompts
  - Delivers: `registerMCPPrompt` / list / get on the default `/mcp` server
  - Files: `api/src/mcp/prompts.ts`, `api/src/mcp/prompts.test.ts`, `api/src/mcp/server.ts`, `api/src/mcp/registry.ts`
  - Blocked by: Task 1.1
  - Docs: `docs/how-to/add-mcp-prompts-and-resources.md` (create; prompts section)
  - Skills: `terreno-backend-api`, `update-docs`
  - Acceptance: HTTP or in-process MCP client `prompts/list` includes the prompt; `prompts/get` returns messages; `shouldRegister: false` hides it; tools still list

- [ ] **Task 1.3**: Register and serve resources
  - Delivers: `registerMCPResource` / list / read on `/mcp`
  - Files: `api/src/mcp/resources.ts`, `api/src/mcp/resources.test.ts`, `api/src/mcp/server.ts`, `api/src/mcp/registry.ts`
  - Blocked by: Task 1.1
  - Docs: same how-to, resources section
  - Skills: `terreno-backend-api`, `update-docs`
  - Acceptance: `resources/list` + `resources/read` for a `terreno://` or `app://` URI; missing URI is an MCP error; hidden resource omitted

- [ ] **Task 1.4**: CRUD tool annotations
  - Delivers: generated list/read `readOnlyHint`; delete `destructiveHint`; create/update not read-only
  - Files: `api/src/mcp/toolGenerator.ts`, `api/src/mcp/toolGenerator.test.ts`
  - Blocked by: Task 1.1
  - Docs: `docs/how-to/expose-mcp-tools.md` one-line note
  - Skills: `terreno-backend-api`, `update-docs`
  - Acceptance: tests assert annotation flags on generated tool defs passed to `registerTool`

- [ ] **Task 1.5**: Example-backend tracer primitives
  - Delivers: one prompt + one resource next to existing custom tool; README how to list them
  - Files: `example-backend/src/` (MCP module or next to `usersTodoStatus`), `example-backend/README.md`
  - Blocked by: Task 1.2, Task 1.3
  - Docs: example README only
  - Skills: `terreno-backend-api`, `update-docs`
  - Acceptance: booting example-backend, authenticated `prompts/list` and `resources/list` return the new names (test or documented curl/Inspector steps plus an API integration test)

---

### Phase 2: Named servers

- [ ] **Task 2.1**: `mountMCPServer` path + include lists
  - Delivers: second mount that only exposes named tools/prompts/resources; default `/mcp` still union
  - Files: `api/src/mcp/server.ts`, `api/src/mcp/server.test.ts`, `api/src/terrenoApp.ts` (optional `mcpServers` or `configureApp` example)
  - Blocked by: Task 1.2, Task 1.3
  - Docs: `docs/how-to/expose-mcp-tools.md` named-server section; `docs/reference/api.md`
  - Skills: `terreno-backend-api`, `update-docs`
  - Acceptance: test app mounts `/mcp` and `/mcp/weather`; weather path lists only included names; `/mcp` still has CRUD + weather tool if globally registered

- [ ] **Task 2.2**: TerrenoApp helper for extra servers
  - Delivers: documented `configureApp` or `app.addMCPServer` so consumers do not call `mountMCPServer` internals
  - Files: `api/src/terrenoApp.ts`, `api/src/terrenoApp.test.ts` (or server tests), `api/src/index.ts`
  - Blocked by: Task 2.1
  - Docs: reference + how-to
  - Skills: `terreno-backend-api`, `update-docs`
  - Acceptance: public method/options covered by a test that boots `TerrenoApp` and hits both paths

---

### Phase 3: Factories + optional generators

- [ ] **Task 3.1**: `defineMCPTool` / `defineMCPPrompt` / `defineMCPResource`
  - Delivers: exported factories that call register functions; example-backend migrated to factories
  - Files: `api/src/mcp/define.ts`, `api/src/mcp/define.test.ts`, `api/src/index.ts`, example-backend MCP module
  - Blocked by: Task 1.5
  - Docs: how-to examples switch to `defineMCP*`
  - Skills: `terreno-backend-api`, `update-docs`
  - Acceptance: factories are the documented API; `registerMCPTool` still exported

- [ ] **Task 3.2** (optional): Hosted `terreno_generate_mcp_tool`
  - Delivers: Boost MCP tool that returns a `defineMCPTool` snippet
  - Files: `mcp-server/src/tools.ts` (+ tests), prompt/resource variants if cheap
  - Blocked by: Task 3.1
  - Docs: `docs/reference/mcp-server.md` tool table
  - Skills: `update-docs`
  - Acceptance: tool returns TypeScript that typechecks against the public factory types (snapshot or compile test). Skip entire task if timeboxed out; note skip in PR.

---

### Phase 4: Test helpers + Inspector how-to

- [ ] **Task 4.1**: `invokeMCPTool` / `invokeMCPPrompt` / `readMCPResource`
  - Delivers: helpers used by api tests; Laravel-like assertions
  - Files: `api/src/mcp/testHelpers.ts`, `api/src/mcp/testHelpers.test.ts`, re-export from a test-only path if needed so consumers can import
  - Blocked by: Task 1.2, Task 1.3
  - Docs: how-to testing section
  - Skills: `terreno-backend-api`, `backend-test-env`, `update-docs`
  - Acceptance: helper test authenticates a user, calls the tracer tool, asserts JSON; unauthenticated call matches production auth rules

- [ ] **Task 4.2**: MCP Inspector operator docs
  - Delivers: copy-paste Inspector command against example-backend `/mcp` with bearer header
  - Files: `docs/how-to/add-mcp-prompts-and-resources.md` or `docs/how-to/expose-mcp-tools.md`
  - Blocked by: Task 1.5
  - Docs: that how-to only
  - Skills: `update-docs`
  - Acceptance: command uses current example-backend URL/port; auth header documented; no vendored Inspector binary

---

### Phase 5: First-party client

- [ ] **Task 5.1**: `MCPService` Streamable HTTP default
  - Delivers: tools listed over HTTP against `mountMCPServer`; SSE still selectable
  - Files: `ai/src/service/mcpService.ts`, `ai/src/service/mcpService.test.ts`, types
  - Blocked by: Task 2.1 (server stable)
  - Docs: `docs/reference/ai.md` if MCPService is documented there; else api/ai README
  - Skills: `terreno-data-fetching`, `update-docs`
  - Acceptance: test does not mock away the transport type; SSE path still unit-tested

- [ ] **Task 5.2**: Client prompt + resource methods
  - Delivers: `listPrompts` / `getPrompt` / `listResources` / `readResource` on `MCPService`
  - Files: `ai/src/service/mcpService.ts` + tests
  - Blocked by: Task 5.1, Task 1.2, Task 1.3
  - Docs: same reference
  - Skills: `terreno-data-fetching`, `update-docs`
  - Acceptance: methods return the tracer prompt/resource from Phase 1 example or a test server

---

### Phase 6: Explanation page

- [ ] **Task 6.1**: Two-layer MCP explanation
  - Delivers: `docs/explanation/app-mcp.md` + index link; Boost IP and model-router-mcp “related work” already point here
  - Files: `docs/explanation/app-mcp.md`, `docs/explanation/README.md`
  - Blocked by: Task 2.2, Task 3.1 (API names stable)
  - Docs: that explanation + README
  - Skills: `update-docs`
  - Acceptance: page states Boost vs app MCP in a table; points at how-to; does not document OAuth as shipped

---

## Frontier after Approve

Unblocked: **Task 1.1**.
Blocked until 1.1: 1.2–1.4.
1.5 after 1.2+1.3.
2.x after prompts+resources.
4.1 can start after 1.2+1.3 in parallel with 2.x.
5.x after server HTTP surface is stable (2.1).
6.1 last for name-stable docs.
