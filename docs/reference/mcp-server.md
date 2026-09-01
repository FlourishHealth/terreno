# @terreno/mcp

Published npm package for the Terreno Model Context Protocol (MCP) server. The monorepo directory is still `mcp-server/`. The package exposes:

- **`terreno-mcp`** — HTTP server used in Cloud Run and local debugging (`src/index.ts`)
- **`terreno-mcp-local`** — stdio server for project runtime tools (`src/local/index.ts`): `application_info`, `database_schema`, `database_query`, `read_logs`, `last_error`, `get_rtk_state`, `evaluate` (gated by `TERRENO_MCP_EVAL`), `navigate` (CDP wiring planned). `application_info` reads bootstrap `backend/` + `frontend/`, or this monorepo's `example-backend/` + `example-frontend/` (bootstrap names win when both exist).

It provides AI coding assistants with documentation access, code generation tools, and workflow prompts.

Both HTTP MCP surfaces (`@terreno/mcp` and the `modelRouter` endpoint in
`@terreno/api`) use the MCP TypeScript SDK v2 and speak the stateless
`2026-07-28` protocol revision. The HTTP handlers retain the SDK's stateless
legacy fallback for 2025-era clients. `terreno-mcp-local` uses v2 `serveStdio`,
which negotiates the connection era and pins one server instance for that
connection.

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
- **Tools**: Code generators that return text (AI writes files), documentation search (`terreno_search_docs`, `terreno_get_component_docs`), upgrade notes (`terreno_get_upgrade_guide`), plus local-only tools when using `terreno-mcp-local`
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

### terreno_search_docs

BM25-style keyword search over markdown bundled with the MCP server: `docs/resources/*.md`, synced Diátaxis docs under `docs/versioned/`, and per-component excerpts derived from `ui-types-documentation.json`. **Prefer this tool before guessing** Terreno APIs (same posture as Laravel Boost `search-docs`).

**Parameters:**

``````typescript
{
  queries: string[];       // Required — one or more search phrases
  packages?: string[];     // Optional — filter by package id or scope, e.g. ["api", "@terreno/ui"]
  tokenLimit?: number;      // Approximate max tokens of markdown (default 3000)
  version?: string;         // Optional @terreno/* lockstep version (e.g. 57.2.0). Omit for current `next` docs.
}
``````

Unmatched versions fall back to the nearest retained snapshot (`website/versioned_docs/`, copied into `docs/versioned/` at MCP build). The response names the resolved version and includes a note when a fallback happened. Pass the consumer app's `@terreno/*` version from `application_info` or `package.json`. Range prefixes such as `^57.2.0` are stripped before matching.

### terreno_get_component_docs

Returns the full props table for a single `@terreno/ui` component from `ui-types-documentation.json`, plus short related markdown excerpts when the search index finds matches.

**Parameters:**

``````typescript
{
  component: string;        // e.g. "Button", "TextField"
  version?: string;         // Optional @terreno/* lockstep version. Omit for current TypeDoc props.
}
``````

When `version` matches a retained docs snapshot, the tool returns that version's generated component page (MDX chrome stripped). Otherwise it uses current `ui-types-documentation.json` and notes the fallback.

### terreno_get_upgrade_guide

Return bundled Terreno lockstep upgrade notes between two semver versions (markdown). Use before major bumps to `@terreno/*` packages. The response always lists which versions in the range **have** notes. If some or all versions have none, it names those gaps — an empty concatenation would look like “nothing changed,” which is usually false. `fromVersion` must be less than or equal to `toVersion`. Note format: `mcp-server/src/docs/upgrades/README.md`.

**Parameters:**

``````typescript
{
  fromVersion: string;      // Installed @terreno/* semver (e.g. 0.19.0)
  toVersion: string;        // Target semver to upgrade to (e.g. 0.20.0)
}
``````

### terreno_generate_model

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

### terreno_generate_route

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

### terreno_generate_screen

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

### terreno_generate_form_fields

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

### terreno_validate_model_schema

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

### terreno_bootstrap_app

Scaffold a new full-stack Terreno application (Expo frontend, Express/Mongoose backend, Cursor rules, MCP settings).

**Parameters:**

``````typescript
{
  appName: string;           // kebab-case (e.g., "my-app")
  appDisplayName: string;    // Human-readable name
  description?: string;
  mcpServerUrl?: string;     // Default: https://mcp.terreno.app
}
``````

**Returns:** File list, setup instructions, and full file contents for backend, frontend, CI workflows, and MCP configuration.

The generated Profile tab (`frontend/app/(tabs)/profile.tsx`) uses `@terreno/ui` `TapToEdit` for name, email, and password. Each field saves independently with `PATCH /auth/me` (`usePatchMeMutation`). Name and email each have their own `useEffect`, so saving one field does not wipe an in-progress edit on the other.

The generated app is expected to install and boot with no manual follow-up, so the
scaffold deliberately ships no binary assets and no references to files it does not
create:

- **Fonts** come from `@terreno/ui`. `TerrenoProvider` wraps children in
  `TerrenoFontProvider`, which loads Nunito and Titillium Web from
  `@expo-google-fonts/*`. The generated `app/_layout.tsx` calls no `useFonts` of its own.
- **Icon, splash, and favicon** are left unset in `app.json` so Expo uses its built-in
  defaults. Point them at real files once the app has branding.
- **`metro.config.js`** pins every `jspdf` request to `jspdf/dist/jspdf.es.min.js` on web
  and drops it on native. `@terreno/admin-frontend` pulls jspdf in for consent-PDF export,
  and jspdf's CommonJS and Node builds contain an AMD-style `require(["html2canvas"], cb)`
  call that Metro's static transform cannot parse — without the override it fails the whole
  bundle, including Expo Router's static web render.
- **Auth-gated routes** use `<Stack.Protected guard={...}>`. Wrapping `Stack.Screen`
  children in a conditional or fragment instead crashes the navigator.
- **`tsconfig.json`** sets no `baseUrl`; it is deprecated in TypeScript 6 and makes `tsc`
  abort with TS5101 before checking a single file. `paths` resolve relative to the tsconfig.
- **Declared dependencies** include every package generated frontend source imports
  (`react-native-reanimated`, `redux-persist`, `@reduxjs/toolkit`, `@expo/vector-icons`,
  `lodash`, `luxon`, and the rest). Do not rely on transitive installs for those.

### terreno_bootstrap_ai_rules

Scaffold AI coding assistant rules (AGENTS.md, Cursor/Windsurf rules, Copilot instructions, rulesync config).

**Parameters:**

``````typescript
{
  appName: string;
  appDisplayName: string;
  description?: string;
  /** Optional — which @terreno/* packages to merge into rules. Use ids like `api`, `ui`, `rtk`, `admin-backend`, `admin-frontend`, or `@terreno/api`. Omit or pass only what the app uses so admin guidelines stay out of projects without the admin panel. */
  packages?: string[];
}
``````

Guideline bodies are composed from per-package `.ai/guidelines/core.md` files, copied into this package at build time (`bun run sync-package-guidelines` in `mcp-server/`).

**Returns:** Rules files and instructions for installing/syncing with rulesync.

### terreno_install_admin

Generate admin panel integration for `@terreno/admin-backend` and `@terreno/admin-frontend`.

**Parameters:** Model configurations with `modelName`, `routePath`, `displayName`, `listFields`, etc.

**Returns:** Frontend screen files and backend/frontend setup snippets.

## Prompts

Multi-step workflow prompts that guide AI assistants through complex tasks.

### terreno_bootstrap

Workflow prompt for scaffolding a new Terreno app. Delegates to `terreno_bootstrap_app` and `terreno_bootstrap_ai_rules` tools.

**Arguments:**

- `appName` (string) — Application name in kebab-case
- `appDisplayName` (string) — Human-readable display name

### terreno_upgrade

Lockstep Terreno upgrade workflow: read bundled upgrade notes, bump `@terreno/*` packages, run tests, and delegate Expo SDK steps to the official upgrading-expo skill.

**Arguments:** `targetVersion` (optional) — target `@terreno/*` semver; omit to mean latest stable.

### terreno_create_crud_feature

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

### terreno_create_api_endpoint

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

### terreno_create_ui_component

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

### terreno_create_form_screen

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

### terreno_add_authentication

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

### terreno_migrate_to_terreno_app

Guide for migrating from `setupServer` to the `TerrenoApp` fluent API pattern.

**Arguments:**

- `serverFile` (string, optional) — Path to server file to migrate (e.g., `src/server.ts`)

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

# (Build runs sync-ui-docs, sync-versioned-docs, and sync-package-guidelines before tsc.)
# To refresh only bundled package AI guidelines from the monorepo:
# bun run sync-package-guidelines

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
