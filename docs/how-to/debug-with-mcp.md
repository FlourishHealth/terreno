# Debug a Terreno app with MCP

Start the backend and frontend, reproduce the failure once, then inspect the merged runtime evidence
instead of copying logs into the agent chat.

## 1. Read the latest error

Call the local MCP tool:

```json
{"name":"last_error","arguments":{"sources":["backend","browser","metro","app"]}}
```

It returns the newest error-level JSONL/CDP entry. Use `read_logs` when the failure needs surrounding
events:

```json
{
  "name": "read_logs",
  "arguments": {
    "entries": 100,
    "level": "error",
    "sources": ["backend", "browser", "metro", "app"]
  }
}
```

`backend` and `browser` read durable JSONL; `metro` and `app` read in-memory rings populated from
Metro `/events` and CDP. Connection status in the response explains when either live source is
unavailable.

CLI equivalents:

```bash
terreno logs last-error --sources backend,browser,metro,app
terreno logs --entries 100 --level error --sources backend,browser,metro,app
```

## 2. Inspect client state

Check authentication and RTK Query cache state:

```json
{"name":"get_rtk_state","arguments":{"slice":"rtk","query":"todos"}}
```

The tool reads `globalThis.__TERRENO_STORE__` registered by the app, using CDP when the MCP process
cannot access the app heap directly. The CLI equivalent is:

```bash
terreno state --slice rtk --query todos
```

## 3. Verify the fix in the running app

Navigation and arbitrary evaluation are disabled by default. Opt in only for local debugging:

```bash
TERRENO_MCP_EVAL=1 bunx terreno-mcp-local
```

Then call `navigate` with `{"path":"/profile"}` or run:

```bash
TERRENO_MCP_EVAL=1 terreno navigate /profile
```

Confirm the target screen renders, then call `last_error` again. A successful fix has no new
error-level entry after the navigation timestamp.

## Connection problems

- Set `TERRENO_PROJECT_ROOT` if logs or package versions come from the wrong directory.
- Set `TERRENO_METRO_URL` if Metro is not on the frontend script's `--port`.
- Close React Native DevTools when Hermes reports another debugger connection.
- Use only `backend,browser` sources when Metro is intentionally stopped.
