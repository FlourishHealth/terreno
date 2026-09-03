# Connect an MCP client with a service token

Enable personal MCP service tokens on `TerrenoApp`, mint a key from `POST /mcp/service-tokens`, then paste the MCP URL and Bearer `mcp_…` token into an external client.

This page is the enablement path. Client-by-client forms (Perplexity, Cursor, Claude Code) belong in the completed operator guide once the example settings UI ships. For the `/mcp` tools themselves, see [Expose MCP tools](expose-mcp-tools.md).

## 1. Enable the flag

```typescript
new TerrenoApp({
  userModel: User,
  mcpServiceTokens: {
    enabled: true,
    publicMcpUrl: process.env.PUBLIC_API_URL,
  },
});
```

`mcpServiceTokens: true` is the same as `{enabled: true}`. Off (omitted or `enabled: false`) does not mount `/mcp/service-tokens` and does not accept `mcp_` Bearer credentials on `/mcp`.

Pass `publicMcpUrl` so create responses include a copy-paste MCP URL (`…/mcp` is appended when missing).

## 2. Mint a token

Sign in with a session or JWT, then:

```bash
curl -X POST "$API/mcp/service-tokens" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Perplexity"}'
```

The JSON `data.token` value is shown **once**. List and revoke never return it. Store it in the MCP client, not in logs.

## 3. Call `/mcp`

Perplexity probes with GET, then POSTs JSON-RPC. Send the same Bearer on both.

GET does **not** authenticate. This server has no GET SSE stream, so `/mcp` answers `405` with `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."}}` whether or not the key is valid. That 405 is the expected probe.

POST `initialize` and `tools/list` are the unauthenticated catalog in the stateless handler. The Bearer is checked when a **tool runs** (`tools/call`). A missing or invalid `mcp_` key then returns `Permission denied: authentication required`.

```bash
curl -X GET "$API/mcp" \
  -H "Authorization: Bearer mcp_…" \
  -H "Accept: application/json, text/event-stream"

curl -X POST "$API/mcp" \
  -H "Authorization: Bearer mcp_…" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

The token acts as the owning user on MCP only. It cannot mint or list tokens, and it is not valid on REST, sync, or admin routes.
