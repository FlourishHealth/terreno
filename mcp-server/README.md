# @terreno/mcp-server

MCP (Model Context Protocol) server for Terreno. Provides documentation, tools, and prompts for building full-stack applications with Terreno packages.

## Features

### Resources

Documentation resources accessible via MCP:

- `terreno://docs/overview` - Overview of the Terreno monorepo
- `terreno://docs/api` - @terreno/api documentation
- `terreno://docs/ui` - @terreno/ui documentation
- `terreno://docs/rtk` - @terreno/rtk documentation
- `terreno://docs/patterns` - Common patterns and best practices

### Tools

Code generation tools:

- `generate_model` - Generate a Mongoose model with proper Terreno conventions
- `generate_route` - Generate a modelRouter route configuration
- `generate_screen` - Generate a React Native screen component
- `generate_form_fields` - Generate form field components
- `validate_model_schema` - Validate a Mongoose schema follows conventions

### Prompts

Code generation prompts:

- `create_crud_feature` - Generate complete CRUD feature (model, routes, screens)
- `create_api_endpoint` - Generate custom API endpoint with OpenAPI docs
- `create_ui_component` - Generate reusable UI component
- `create_form_screen` - Generate form screen with validation
- `add_authentication` - Generate authentication setup
- `terreno_style_guide` - Get the Terreno code style guide

## Installation

```bash
# From the monorepo root
bun install
bun run mcp:build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "terreno": {
      "command": "node",
      "args": ["/path/to/terreno/mcp-server/dist/index.js"]
    }
  }
}
```

### With Claude Code CLI

Add to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "terreno": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"]
    }
  }
}
```

## Development

```bash
# Build
bun run build

# Watch mode
bun run dev

# Start server
bun run start

# Run tests
bun run test

# Lint
bun run lint
```

## Docker

Build and run the MCP server in Docker:

```bash
# Build the image
docker build -t terreno-mcp-server ./mcp-server

# Run the container
docker run --rm terreno-mcp-server
```

## CI/CD

The MCP server includes GitHub Actions workflows:

### CI Workflow (`.github/workflows/mcp-server-ci.yml`)
- Runs on every push/PR to `mcp-server/**`
- Lints, builds, and tests the code
- Builds Docker image to verify it works

### Deploy Workflow (`.github/workflows/mcp-server-deploy.yml`)
- Runs on push to `master`/`main` branch
- Deploys to Google Cloud Run

### Required GitHub Secrets for Deployment

Configure these secrets in your GitHub repository:

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Your Google Cloud project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation provider |
| `GCP_SERVICE_ACCOUNT` | Service account email for deployment |
| `GCP_ARTIFACT_REGISTRY` | Artifact Registry repository name |

### Setting up GCP for Deployment

1. Create an Artifact Registry repository:
   ```bash
   gcloud artifacts repositories create terreno \
     --repository-format=docker \
     --location=us-central1
   ```

2. Set up Workload Identity Federation for GitHub Actions:
   ```bash
   # Create workload identity pool
   gcloud iam workload-identity-pools create "github" \
     --location="global" \
     --display-name="GitHub Actions"

   # Create provider
   gcloud iam workload-identity-pools providers create-oidc "github" \
     --location="global" \
     --workload-identity-pool="github" \
     --display-name="GitHub" \
     --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
     --issuer-uri="https://token.actions.githubusercontent.com"
   ```

3. Grant permissions to the service account:
   ```bash
   # Cloud Run deployment
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:SA_EMAIL" \
     --role="roles/run.admin"

   # Artifact Registry push
   gcloud artifacts repositories add-iam-policy-binding terreno \
     --location=us-central1 \
     --member="serviceAccount:SA_EMAIL" \
     --role="roles/artifactregistry.writer"
   ```

## Example Tool Usage

### Generate a Model

```json
{
  "name": "generate_model",
  "arguments": {
    "name": "Product",
    "fields": [
      { "name": "title", "type": "String", "required": true },
      { "name": "price", "type": "Number", "required": true },
      { "name": "active", "type": "Boolean", "default": "true" }
    ],
    "hasOwner": true,
    "softDelete": true
  }
}
```

### Generate a Route

```json
{
  "name": "generate_route",
  "arguments": {
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
}
```

### Generate a Screen

```json
{
  "name": "generate_screen",
  "arguments": {
    "name": "ProductList",
    "type": "list",
    "modelName": "Product",
    "fields": ["title", "price"]
  }
}
```

## Example Prompt Usage

### Create CRUD Feature

```
Prompt: create_crud_feature
Arguments:
  - name: "Product"
  - fields: "title:string,price:number,description:string,active:boolean"
  - hasOwner: "yes"
```

This will generate a comprehensive prompt with instructions for creating:
- Backend model with proper schema
- API routes with permissions
- Frontend list, detail, and form screens
