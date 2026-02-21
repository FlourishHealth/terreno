# @terreno/mcp-server

Model Context Protocol (MCP) server for Terreno. Provides AI coding assistants with documentation access, code generation tools, and workflow prompts.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Resources](#resources)
- [Tools](#tools)
- [Prompts](#prompts)
- [Environment Variables](#environment-variables)
- [Development](#development)

## Overview

The MCP server exposes Terreno's documentation and code generation capabilities through the Model Context Protocol, enabling AI assistants (like Claude in Cursor or Claude Desktop) to:

- Access up-to-date documentation for all Terreno packages
- Generate boilerplate code following Terreno conventions
- Provide multi-step workflows for common development tasks

**Key concepts:**

- **Resources**: Read-only documentation from `docs/` directory
- **Tools**: Executable code generators that return text (AI writes files)
- **Prompts**: Pre-built multi-step instructions for complex workflows

## Installation

### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

``````json
{
  "mcpServers": {
    "terreno": {
      "command": "bun",
      "args": ["/absolute/path/to/terreno/mcp-server/dist/index.js"]
    }
  }
}
``````

### With Claude Code CLI

Add to your project's `.claude/settings.json`:

``````json
{
  "mcpServers": {
    "terreno": {
      "command": "bun",
      "args": ["./mcp-server/dist/index.js"]
    }
  }
}
``````

### Building from Source

``````bash
# From monorepo root
bun install
bun run mcp:build

# Or from mcp-server directory
cd mcp-server
bun run build
``````

## Resources

Documentation resources accessible via `terreno://` protocol:

| URI | Description |
|-----|-------------|
| `terreno://docs/overview` | Monorepo overview and architecture |
| `terreno://docs/api` | @terreno/api reference documentation |
| `terreno://docs/ui` | @terreno/ui reference documentation |
| `terreno://docs/rtk` | @terreno/rtk reference documentation |
| `terreno://docs/patterns` | Common patterns and best practices |

**How it works:**

- Resources are loaded from markdown files in `docs/` directory
- Content is transformed and served via MCP protocol
- AI assistants cache resources for fast lookup
- Updates require MCP server restart

**Custom docs directory:**

Set `TERRENO_MCP_DOCS_DIR` environment variable to override default path.

## Tools

Code generation tools that return TypeScript/JavaScript code as text. **Tools do not write files** — the AI assistant receives the code and writes it to appropriate locations.

### generate_model

Generate a Mongoose model with Terreno conventions (timestamps, soft delete, owner tracking, type definitions).

**Parameters:**

``````typescript
{
  name: string;              // Model name (PascalCase)
  fields: Array<{
    name: string;            // Field name (camelCase)
    type: string;            // "String" | "Number" | "Boolean" | "Date" | "ObjectId"
    required?: boolean;
    default?: string;        // Default value as string
    ref?: string;            // Referenced model name (for ObjectId)
    description?: string;    // Field description (recommended)
  }>;
  hasOwner?: boolean;        // Add ownerId field (default: false)
  softDelete?: boolean;      // Add deleted field (default: false)
  timestamps?: boolean;      // Add created/updated fields (default: true)
}
``````

**Example:**

``````json
{
  "name": "Product",
  "fields": [
    {"name": "title", "type": "String", "required": true, "description": "Product title"},
    {"name": "price", "type": "Number", "required": true, "description": "Price in cents"},
    {"name": "active", "type": "Boolean", "default": "true", "description": "Is product active"}
  ],
  "hasOwner": true,
  "softDelete": true
}
``````

**Returns:**

- Model schema code with proper type definitions
- Methods and statics structure
- Plugin configuration
- Export statements

### generate_route

Generate modelRouter configuration with permissions and query options.

**Parameters:**

``````typescript
{
  modelName: string;         // Model name (PascalCase)
  routePath: string;         // API path (e.g., "/products")
  permissions?: {
    create?: "any" | "authenticated" | "admin" | "owner";
    list?: "any" | "authenticated" | "admin" | "owner";
    read?: "any" | "authenticated" | "admin" | "owner";
    update?: "any" | "authenticated" | "admin" | "owner";
    delete?: "any" | "authenticated" | "admin" | "owner";
  };
  queryFields?: string[];    // Allowed query parameters
  ownerFiltered?: boolean;   // Apply OwnerQueryFilter (default: false)
  sort?: string;             // Default sort order (e.g., "-created")
  populate?: Array<{path: string; fields?: string[]}>;
}
``````

**Example:**

``````json
{
  "modelName": "Product",
  "routePath": "/products",
  "permissions": {
    "create": "authenticated",
    "list": "any",
    "read": "any",
    "update": "owner",
    "delete": "admin"
  },
  "queryFields": ["active", "category"],
  "ownerFiltered": true,
  "sort": "-created"
}
``````

**Returns:**

- Router setup code with modelRouter configuration
- Permission mapping
- Lifecycle hooks structure
- Instructions for registering route

### generate_screen

Generate React Native screen component with Terreno UI components.

**Parameters:**

``````typescript
{
  name: string;              // Screen name (PascalCase)
  type: "list" | "detail" | "form" | "empty";
  modelName?: string;        // Model name for CRUD screens
  fields?: string[];         // Fields to display/edit
  hasSearch?: boolean;       // Add search bar (list screens)
  hasPagination?: boolean;   // Add pagination (list screens)
}
``````

**Example:**

``````json
{
  "name": "ProductList",
  "type": "list",
  "modelName": "Product",
  "fields": ["title", "price", "active"],
  "hasSearch": true,
  "hasPagination": true
}
``````

**Returns:**

- React Native functional component
- RTK Query hooks integration
- @terreno/ui components (Box, Text, Button, Card, etc.)
- Loading/error/empty states

### generate_form_fields

Generate form field components for a model.

**Parameters:**

``````typescript
{
  modelName: string;         // Model name (PascalCase)
  fields: Array<{
    name: string;
    type: "text" | "number" | "boolean" | "date" | "select";
    required?: boolean;
    options?: string[];      // For select fields
  }>;
}
``````

**Example:**

``````json
{
  "modelName": "Product",
  "fields": [
    {"name": "title", "type": "text", "required": true},
    {"name": "price", "type": "number", "required": true},
    {"name": "category", "type": "select", "options": ["electronics", "books", "clothing"]}
  ]
}
``````

**Returns:**

- TextField, NumberField, SelectField components
- Validation logic structure
- Form state management pattern

### validate_model_schema

Validate a Mongoose schema against Terreno conventions.

**Parameters:**

``````typescript
{
  schemaCode: string;        // Full schema code to validate
}
``````

**Returns:**

- List of convention violations
- Recommendations for fixes
- Severity levels (error, warning, info)

## Prompts

Multi-step workflow prompts that guide AI assistants through complex tasks.

### create_crud_feature

Generate complete CRUD feature: backend model + routes + frontend screens.

**Arguments:**

- `name` (string) — Feature name (e.g., "Product")
- `fields` (string) — Comma-separated fields: `title:string,price:number,active:boolean`
- `hasOwner` (string) — "yes" or "no" (default: "no")

**Workflow:**

1. Generate Mongoose model with type definitions
2. Generate API routes with permissions
3. Generate list screen with DataTable
4. Generate detail screen
5. Generate form screen with validation
6. Provide instructions for:
   - Registering routes in `server.ts`
   - Regenerating SDK: `bun run sdk`
   - Adding navigation

### create_api_endpoint

Generate custom (non-CRUD) API endpoint with OpenAPI documentation.

**Arguments:**

- `path` (string) — Endpoint path (e.g., "/stats/summary")
- `method` (string) — HTTP method ("get", "post", "patch", "delete")
- `description` (string) — What the endpoint does

**Workflow:**

1. Generate route handler with asyncHandler
2. Generate OpenAPI builder configuration
3. Generate response types
4. Provide authentication setup instructions
5. Provide SDK regeneration instructions

### create_ui_component

Generate reusable UI component following @terreno/ui patterns.

**Arguments:**

- `name` (string) — Component name (PascalCase)
- `type` (string) — "display" | "interactive" | "form" | "layout"
- `description` (string) — Component purpose

**Workflow:**

1. Generate component structure with TypeScript types
2. Include @terreno/ui imports (Box, Text, Button, etc.)
3. Add prop definitions with JSDoc
4. Include usage example
5. Provide testing setup

### create_form_screen

Generate form screen with validation and error handling.

**Arguments:**

- `name` (string) — Screen name (e.g., "CreateProduct")
- `modelName` (string) — Model being created/edited
- `fields` (string) — Comma-separated: `title:text,price:number,active:boolean`

**Workflow:**

1. Generate screen component with Page layout
2. Add form fields from @terreno/ui
3. Include validation logic
4. Add RTK mutation hooks
5. Add loading/error/success states
6. Provide navigation setup

### add_authentication

Generate authentication setup for new projects.

**Arguments:**

- `strategies` (string) — Comma-separated: "email", "github", "google"
- `includeRefreshToken` (string) — "yes" or "no" (default: "yes")

**Workflow:**

1. Configure User model with passport-local-mongoose
2. Set up auth routes in backend
3. Configure Redux auth slice in frontend
4. Generate login screen
5. Generate signup screen
6. Set up token storage
7. Provide environment variable list

### terreno_style_guide

Returns comprehensive code style guide from project documentation.

**No arguments required.**

**Returns:**

- TypeScript conventions
- React/React Native patterns
- Backend API conventions
- Testing practices
- Logging guidelines

## Environment Variables

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `MCP_HOST` or `HOST` | `0.0.0.0` | Server host address |
| `TERRENO_MCP_DOCS_DIR` | `../docs` | Path to documentation directory (relative to dist/) |

**Example:**

``````bash
PORT=3001 HOST=localhost bun run start
``````

## Development

``````bash
# Install dependencies
bun install

# Build
bun run build

# Watch mode (rebuilds on changes)
bun run dev

# Start server
bun run start

# Lint
bun run lint

# Fix lint issues
bun run lint:fix
``````

### Docker

``````bash
# Build image
docker build -t terreno-mcp-server ./mcp-server

# Run container
docker run --rm -p 8080:8080 terreno-mcp-server
``````

### Testing with MCP Inspector

``````bash
# Start server
bun run start

# In another terminal, use MCP inspector
npx @modelcontextprotocol/inspector bun run ./mcp-server/dist/index.js
``````

## Architecture

``````
mcp-server/
├── src/
│   ├── index.ts          # Express server + JSON-RPC handlers
│   ├── resources.ts      # Documentation resource loader
│   ├── tools.ts          # Code generation tools
│   ├── prompts.ts        # Workflow prompts
│   └── docs/             # Inline documentation content
├── dist/                 # Compiled output
└── Dockerfile            # Container image
``````

**JSON-RPC 2.0 handlers:**

- `resources/list` — List available documentation
- `resources/read` — Read documentation content
- `tools/list` — List available tools
- `tools/call` — Execute a tool
- `prompts/list` — List available prompts
- `prompts/get` — Get prompt details

## Deployment

See [mcp-server/README.md](../../mcp-server/README.md#cicd) for:

- GitHub Actions workflows
- Google Cloud Run deployment
- Required secrets configuration
- Workload Identity Federation setup
