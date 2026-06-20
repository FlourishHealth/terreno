---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "@terreno/mcp - MCP server for AI assistant integration"
globs: ["**/*"]
---

# @terreno/mcp

Model Context Protocol (MCP) server that provides tools, prompts, and resources for AI coding assistants to generate Terreno-compatible code. Built with Express and JSON-RPC 2.0.

## Commands

```bash
bun run build            # Build the server
bun run dev              # Development mode
bun run start            # Start the server
bun run lint             # Lint code
```

## Architecture

### File Structure

```
src/
  index.ts               # Express HTTP server with JSON-RPC handlers
  tools.ts               # Code generation tools (models, routes, screens, forms)
  prompts.ts             # Multi-step workflow prompts (CRUD, auth, components)
  resources.ts           # Documentation resources loaded from markdown
```

## Available Tools

| Tool | Description |
|------|-------------|
| `terreno_bootstrap_app` | Scaffold a new full-stack Terreno app (frontend, backend, rules, MCP) |
| `terreno_bootstrap_ai_rules` | Scaffold AI assistant rules for Cursor, Claude Code, Copilot, etc. |
| `terreno_generate_model` | Creates Mongoose schemas with Terreno conventions (plugins, types, methods/statics) |
| `terreno_generate_route` | Creates modelRouter configurations with permission setup |
| `terreno_generate_screen` | Creates React Native screens (list, detail, form, empty types) |
| `terreno_generate_form_fields` | Generates form field components with validation |
| `terreno_validate_model_schema` | Validates schemas against Terreno conventions |
| `terreno_install_admin` | Generates admin panel integration files and instructions |

Each tool returns generated code wrapped with file path instructions and additional setup steps.

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `terreno_bootstrap` | Workflow for scaffolding a new Terreno application |
| `terreno_create_crud_feature` | Full CRUD generation: model + routes + screens |
| `terreno_create_api_endpoint` | Custom API endpoint with OpenAPI docs |
| `terreno_create_ui_component` | Reusable UI component (display, interactive, form, layout) |
| `terreno_create_form_screen` | Form screen with validation |
| `terreno_add_authentication` | Auth setup with feature selection |
| `terreno_migrate_to_terreno_app` | Migrate from setupServer to TerrenoApp pattern |
| `terreno_style_guide` | Code style guide from project markdown |

Prompts provide detailed requirements, example code patterns, and step-by-step setup instructions.

## Available Resources

- Terreno overview documentation
- @terreno/api documentation
- @terreno/ui documentation
- @terreno/rtk documentation
- Patterns and best practices

Resources are loaded from markdown files with dynamic path resolution.

## Server

- Express-based HTTP server with JSON-RPC 2.0 protocol
- Handles: ListResources, ReadResource, ListTools, CallTool, ListPrompts, GetPrompt
- Configurable port and host via environment variables
- Health check endpoint at root

## Adding a New Tool

```typescript
// In src/tools.ts
{
  name: "terreno_my_tool",
  description: "What it does",
  inputSchema: {
    type: "object",
    properties: {
      name: {type: "string", description: "Resource name"},
    },
    required: ["name"],
  },
  handler: (args) => {
    return {content: [{type: "text", text: generatedCode}]};
  },
}
```

## Conventions

- Use TypeScript with ES modules
- Prefer const arrow functions
- Named exports preferred
- Use `logger.info/warn/error/debug` for permanent logs
