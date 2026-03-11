# @terreno/mcp-server

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
| `generate_model` | Creates Mongoose schemas with Terreno conventions (plugins, types, methods/statics) |
| `generate_route` | Creates modelRouter configurations with permission setup |
| `generate_screen` | Creates React Native screens (list, detail, form, empty types) |
| `generate_form_fields` | Generates form field components with validation |
| `validate_model_schema` | Validates schemas against Terreno conventions |

Each tool returns generated code wrapped with file path instructions and additional setup steps.

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `create_crud_feature` | Full CRUD generation: model + routes + screens |
| `create_api_endpoint` | Custom API endpoint with OpenAPI docs |
| `create_ui_component` | Reusable UI component (display, interactive, form, layout) |
| `create_form_screen` | Form screen with validation |
| `add_authentication` | Auth setup with feature selection |
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
  name: "my_tool",
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
