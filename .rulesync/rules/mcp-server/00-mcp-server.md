---
localRoot: true
targets: ["claudecode"]
description: "MCP server package guidelines"
globs: ["**/*"]
---

# @terreno/mcp-server

Model Context Protocol (MCP) server for Terreno.

## Commands

```bash
bun run build            # Build the server
bun run dev              # Development mode
bun run start            # Start the server
bun run lint             # Lint code
```

## Purpose

Provides MCP server functionality for AI coding assistants to interact with Terreno packages.

## Code Style

- Use TypeScript with ES modules
- Use Luxon for dates (not Date or dayjs)
- Prefer const arrow functions
- Named exports preferred
- Use `logger.info/warn/error/debug` for permanent logs
