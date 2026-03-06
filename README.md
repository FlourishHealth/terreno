# Terreno

[![@terreno/api](https://img.shields.io/npm/v/@terreno/api?label=%40terreno%2Fapi)](https://www.npmjs.com/package/@terreno/api)
[![@terreno/ui](https://img.shields.io/npm/v/@terreno/ui?label=%40terreno%2Fui)](https://www.npmjs.com/package/@terreno/ui)
[![@terreno/rtk](https://img.shields.io/npm/v/@terreno/rtk?label=%40terreno%2Frtk)](https://www.npmjs.com/package/@terreno/rtk)
[![@terreno/ai](https://img.shields.io/npm/v/@terreno/ai?label=%40terreno%2Fai)](https://www.npmjs.com/package/@terreno/ai)
[![@terreno/admin-backend](https://img.shields.io/npm/v/@terreno/admin-backend?label=%40terreno%2Fadmin-backend)](https://www.npmjs.com/package/@terreno/admin-backend)
[![@terreno/admin-frontend](https://img.shields.io/npm/v/@terreno/admin-frontend?label=%40terreno%2Fadmin-frontend)](https://www.npmjs.com/package/@terreno/admin-frontend)
[![@terreno/api-health](https://img.shields.io/npm/v/@terreno/api-health?label=%40terreno%2Fapi-health)](https://www.npmjs.com/package/@terreno/api-health)

**The full-stack TypeScript framework for building and launching apps fast.**

Terreno is to React Native + Express what Django is to Python web development: a batteries-included framework where the generic, undifferentiated work is already done so you can focus on what makes your app unique — the business logic.

## Vision

Most apps need the same foundational pieces: authentication, user management, CRUD APIs, admin panels, real-time updates, AI integrations, consent flows, onboarding carousels. These features are table stakes — they don't differentiate your product, but they take weeks to build from scratch. Terreno handles all of it out of the box.

**The goal:** all the low-level, generalized code lives in Terreno. Your app only contains business logic.

### What Terreno gives you today

- **Authentication** — Email/password, Google, GitHub, and Apple OAuth with JWT or Better Auth. Login, signup, token refresh, and session management all built in.
- **REST APIs in minutes** — Define a Mongoose model, pass it to `modelRouter`, and get a full CRUD API with permissions, pagination, filtering, sorting, and OpenAPI docs.
- **90+ UI components** — A themed React Native component library that works on iOS, Android, and web. Forms, tables, modals, navigation — everything you need to build real screens.
- **Auto-generated frontend SDK** — Your backend's OpenAPI spec generates type-safe RTK Query hooks. Change a backend route and regenerate — no manual API wiring.
- **Admin panel** — Register your models and get a full admin interface with list views, forms, and reference linking. No custom admin code needed.
- **AI integration** — Provider-agnostic AI service with streaming chat, text generation, conversation history, and request logging. Plug in any model via Vercel AI SDK.
- **Real-time** — Socket.io integration with auth-aware connections, auto-reconnect, and token refresh.

### Where Terreno is headed

- **Onboarding & signup flows** — Pre-built carousel-based signup experiences that you configure, not code.
- **Consent & legal** — Terms of service, privacy policy, and consent form management baked into the framework.
- **Notifications** — Push notifications, in-app notifications, and email with a unified API.
- **File uploads & media** — Managed file storage with image processing and CDN integration.
- **Feature flags & remote config** — Runtime configuration without redeploying.
- **Background jobs** — Queued task processing for emails, data sync, and scheduled work.

### The best way to build with AI

Terreno is designed to be the best framework for AI-assisted app development. The [MCP server](#mcp-server) gives AI coding assistants deep knowledge of Terreno's conventions, enabling them to generate models, routes, screens, and full CRUD features that follow the framework's patterns exactly. The `bootstrap_app` tool can scaffold a complete, launchable app from a description — not a toy demo, but a real app with auth, data models, and screens ready to ship.

### Philosophy

- **Flexible but opinionated.** Terreno makes strong default choices (Mongoose, RTK Query, Expo Router) so you don't have to. But every layer is configurable when you need it to be.
- **Your app is just business logic.** If most apps need it and it doesn't add unique value to your product, it belongs in Terreno, not in your codebase.
- **Full-stack coherence.** Backend models flow into OpenAPI specs, which generate frontend hooks, which power typed UI components. One change propagates cleanly across the stack.
- **Ship, don't configure.** Terreno optimizes for getting to a launchable product with minimal effort — not for maximum flexibility at the cost of productivity.

## Packages

### Published Packages

- **api/** - REST API framework built on Express/Mongoose (published as `@terreno/api`)
- **ui/** - React Native UI component library (published as `@terreno/ui`)
- **rtk/** - Redux Toolkit Query utilities for @terreno/api backends (published as `@terreno/rtk`)

### Deployed Services

- **mcp-server/** - MCP (Model Context Protocol) server for AI coding assistants (deployed to `mcp.terreno.flourish.health`)

### Example/Demo Apps

- **example-backend/** - Example backend application using `@terreno/api`
- **example-frontend/** - Example frontend application using `@terreno/ui` and `@terreno/rtk`
- **demo/** - Demo app for showcasing and testing UI components

## Development

This project uses [Bun](https://bun.sh/) as the package manager.

```bash
# Install dependencies
bun install
```

### Root Scripts

Run commands across all packages or target specific ones:

```bash
# All packages
bun run compile        # Compile all packages
bun run lint           # Lint all packages
bun run lint:fix       # Fix lint issues in all packages
bun run test           # Run tests in api and ui

# API package (@terreno/api)
bun run api:compile
bun run api:lint
bun run api:test

# UI package (@terreno/ui)
bun run ui:compile
bun run ui:dev         # Watch mode
bun run ui:lint
bun run ui:test

# Demo app
bun run demo:compile
bun run demo:lint
bun run demo:start     # Start dev server
```

You can also use Bun's filter syntax directly:

```bash
bun run --filter '@terreno/ui' compile
bun run --filter '@terreno/api' test
```

## Dependency Management

This monorepo uses [Bun Catalogs](https://bun.sh/docs/install/catalogs) to manage shared dependency versions across workspaces.

Shared dependency versions are defined in the root `package.json` under the `catalog` field:

```json
{
  "catalog": {
    "react": "19.1.0",
    "react-native": "0.81.5",
    "typescript": "~5.8.3"
  }
}
```

Workspace packages reference these versions using `catalog:`:

```json
{
  "dependencies": {
    "react": "catalog:",
    "react-native": "catalog:"
  }
}
```

This ensures consistent versions across all packages. To update a shared dependency version, change it in the root `catalog` and run `bun install`.

## Releasing

Packages are published to npm automatically when you create a release on GitHub. All publishable packages (`@terreno/api`, `@terreno/ui`, `@terreno/rtk`) are kept in lockstep with the same version number.

### Publishing a Release

1. Go to the [Releases page](../../releases) on GitHub
2. Click "Draft a new release"
3. Create a new tag with the version number (e.g., `1.0.0`) - no `v` prefix
4. Fill in the release title and notes
5. Click "Publish release"

The GitHub Action will automatically:
   - Compare the tag with the previous tag to detect which packages have changes
   - Only publish packages that have actual changes since the last release
   - Create a PR to update the `package.json` versions in the repo
   - Send a Slack notification with the results

### How Change Detection Works

The workflow compares each package directory against the previous tag:
- If `api/` has changes since the last tag → `@terreno/api` is published
- If `ui/` has changes since the last tag → `@terreno/ui` is published
- If `rtk/` has changes since the last tag → `@terreno/rtk` is published

If no previous tag exists (first release), all packages are published.

### Version Format

- Use semantic versioning: `1.0.0`, `1.2.3`, `2.0.0-beta.1`
- No `v` prefix - just the version number
- The version from the release tag is applied to all published packages

### Required Secrets

The following secrets must be configured in your GitHub repository:
- `NPM_PUBLISH_TOKEN` - npm access token with publish permissions
- `SLACK_WEBHOOK` - (optional) Slack webhook URL for notifications

## GCP Static Site Hosting

The demo and example-frontend apps are deployed to Google Cloud Storage with CDN. PR previews are deployed automatically.

### GCP Project

- **Project ID**: `flourish-terreno`
- **Region**: `us-east1`

### Buckets

| App | Bucket | Backend Bucket (CDN) |
|-----|--------|---------------------|
| example-frontend | `flourish-terreno-terreno-frontend-example` | `terreno-frontend-example-backend` |
| demo | `flourish-terreno-terreno-demo` | `terreno-demo-backend` |

### Initial Setup

Run the setup script to create all GCS and CDN resources:

```bash
scripts/setup-gcs-hosting.sh
```

This creates:
1. GCS buckets with public read access
2. Static website config with SPA fallback (`index.html` served for 404s)
3. Service account write access (prompts for the SA email)
4. CDN backend buckets, URL maps, static IPs, HTTP proxies, and forwarding rules

After running the script, point DNS records to the output IPs. To add HTTPS, follow the instructions printed at the end.

### Required Secrets

- `GCP_SA_KEY` - Service account key JSON with permissions for GCS and CDN cache invalidation

### Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `frontend-example-deploy.yml` | Push to master (example-frontend/ui/rtk changes) | Builds and deploys to production bucket |
| `frontend-example-deploy.yml` | Pull request | Deploys preview to `_previews/pr-{number}/` |
| `demo-deploy.yml` | Push to master (demo/ui changes) | Builds and deploys to production bucket |
| `demo-deploy.yml` | Pull request | Deploys preview to `_previews/pr-{number}/` |
| `preview-cleanup.yml` | PR closed | Deletes preview files from both buckets |

## MCP Server

Terreno provides an MCP (Model Context Protocol) server that enables AI assistants to interact with your backend API. The server is available at `mcp.terreno.flourish.health`.

### Adding the MCP Server to Claude Code

Add the following to your Claude Code MCP settings file (`~/.claude/claude_desktop_config.json` or `.claude/settings.json` in your project):

```json
{
  "mcpServers": {
    "terreno": {
      "type": "sse",
      "url": "https://mcp.terreno.flourish.health"
    }
  }
}
```

### Adding the MCP Server to Claude Desktop

Add the following to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "terreno": {
      "type": "sse",
      "url": "https://mcp.terreno.flourish.health"
    }
  }
}
```

### Adding the MCP Server to Cursor

Add the following to your Cursor MCP settings (`.cursor/mcp.json` in your project or global settings):

```json
{
  "mcpServers": {
    "terreno": {
      "type": "sse",
      "url": "https://mcp.terreno.flourish.health"
    }
  }
}
```

After adding the configuration, restart your AI assistant to connect to the MCP server.

## AI Rules Management

This project uses [rulesync](https://github.com/dyoshikawa/rulesync) to maintain consistent AI assistant rules across multiple tools (Cursor, Windsurf, Claude Code, GitHub Copilot).

### How It Works

1. **Single source of truth**: Rules are defined in `.rulesync/rules/` as markdown files with YAML frontmatter
2. **Generated files**: Running `bun run rules` generates tool-specific files:
   - `.cursorrules` - Cursor AI rules
   - `.windsurfrules` - Windsurf AI rules
   - `CLAUDE.md` - Claude Code instructions
   - `.github/copilot-instructions.md` - GitHub Copilot instructions
3. **Per-package rules**: Each package has its own rules in addition to root-level rules

### Commands

```bash
bun run rules        # Generate all rule files from source
bun run rules:check  # Verify generated files are up to date (used in CI)
```

### Updating Rules

1. Edit the source files in `.rulesync/rules/`
2. Run `bun run rules` to regenerate all tool-specific files
3. Commit both the source and generated files

The CI workflow (`.github/workflows/rulesync-check.yml`) ensures generated rules stay in sync with source files.

