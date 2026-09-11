import {isAbsolute} from "node:path";

import type {Tool} from "@modelcontextprotocol/server";
import {type BootstrapArgs, generateAllFiles, getFenceLanguage} from "create-terreno-app";
import {isValidAppName, writeScaffold} from "create-terreno-app/writeScaffold";

import {
  composePackageGuidelinesForRules,
  filterGuidelineIdsForRootRules,
  type GuidelinePackageId,
  loadPackageGuidelineMarkdown,
  resolveBootstrapGuidelinePackages,
} from "./packageGuidelines.js";
import {isScaffoldWriteEnabled} from "./scaffoldWriteMode.js";

interface BootstrapToolArgs extends BootstrapArgs {
  /** Absolute parent directory that will contain `<appName>/`. Local MCP only when write guard is set. */
  targetDir?: string;
}

const shellQuote = (value: string): string => {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
};

const formatBootstrapCliCommand = (args: BootstrapArgs): string => {
  const parts = [
    "bunx create-terreno-app",
    shellQuote(args.appName),
    "--display-name",
    shellQuote(args.appDisplayName),
  ];

  if (args.description) {
    parts.push("--description", shellQuote(args.description));
  }

  if (args.mcpServerUrl) {
    parts.push("--mcp-server-url", shellQuote(args.mcpServerUrl));
  }

  return parts.join(" ");
};

const validateBootstrapTargetDir = (targetDir: unknown): string | undefined => {
  if (targetDir === undefined || targetDir === null) {
    return undefined;
  }

  if (typeof targetDir !== "string" || targetDir.trim() === "") {
    return "targetDir must be a non-empty absolute path";
  }

  if (!isAbsolute(targetDir)) {
    return "targetDir must be an absolute path";
  }

  return undefined;
};

export const bootstrapTools: Tool[] = [
  {
    description:
      "Bootstrap a new Terreno full-stack application with frontend (Expo/React Native) and backend (Express/Mongoose) directories, including Cursor rules and MCP settings",
    inputSchema: {
      properties: {
        appDisplayName: {
          description: "Human-readable display name (e.g., 'My Todo App', 'Task Manager')",
          type: "string",
        },
        appName: {
          description:
            "The application name in kebab-case (e.g., 'my-app', 'todo-app'). Used for directory names and package names.",
          type: "string",
        },
        description: {
          description: "A brief description of the app (optional)",
          type: "string",
        },
        mcpServerUrl: {
          default: "https://mcp.terreno.flourish.health",
          description: "URL of the Terreno MCP server for AI assistance",
          type: "string",
        },
        targetDir: {
          description:
            "Optional absolute parent directory for `<appName>/`. Writes only when TERRENO_MCP_WRITE_SCAFFOLD=1 (terreno-mcp-local). Hosted MCP ignores this and returns the CLI command plus file dump.",
          type: "string",
        },
      },
      required: ["appName", "appDisplayName"],
      type: "object",
    },
    name: "terreno_bootstrap_app",
  },
  {
    description:
      "Bootstrap AI coding assistant rules for a Terreno project. Creates configuration files for Cursor, Windsurf, Claude Code, and GitHub Copilot with Terreno-specific guidelines adapted for the project.",
    inputSchema: {
      properties: {
        appDisplayName: {
          description: "Human-readable display name (e.g., 'My Todo App', 'Task Manager')",
          type: "string",
        },
        appName: {
          description:
            "The application name in kebab-case (e.g., 'my-app', 'todo-app'). Used in rule file headers.",
          type: "string",
        },
        description: {
          description: "A brief description of the app (optional)",
          type: "string",
        },
        packages: {
          description:
            'Optional list of Terreno packages to include in merged guidelines (e.g. ["api","ui","rtk"]). Use names like `api`, `ui`, `rtk`, `admin-backend`, `admin-frontend`, or `@terreno/api`. Omit admin packages if the app does not use the admin panel.',
          items: {type: "string"},
          type: "array",
        },
      },
      required: ["appName", "appDisplayName"],
      type: "object",
    },
    name: "terreno_bootstrap_ai_rules",
  },
];

interface BootstrapAiRulesArgs extends BootstrapArgs {
  /** Optional `@terreno/*` package ids to include (e.g. `["api","ui"]`). Omits others from merged guidelines. */
  packages?: string[];
}
const generateRulesyncConfig = (): string => {
  return JSON.stringify(
    {
      $schema:
        "https://raw.githubusercontent.com/dyoshikawa/rulesync/refs/heads/main/config-schema.json",
      baseDirs: ["."],
      delete: true,
      features: ["rules"],
      targets: ["cursor", "windsurf", "claudecode", "copilot"],
      verbose: false,
    },
    null,
    2
  );
};

const REACT_BEST_PRACTICES_MARKDOWN = `## React Best Practices

- Use functional components with \`React.FC\` type
- Import hooks directly: \`import {useEffect, useMemo} from 'react'\`
- Always provide return types for functions
- Add explanatory comment above each \`useEffect\`
- Wrap callbacks in \`useCallback\`
- Prefer const arrow functions
- Use inline styles over \`StyleSheet.create\`
- Use Luxon for date operations
- Place static content and interfaces at beginning of file
- Minimize \`use client\`, \`useEffect\`, and \`setState\`
- Always support React-Native Web
`;

const buildSharedRootRulesMarkdownBody = (
  args: BootstrapArgs,
  rootPackageIds: readonly GuidelinePackageId[]
): string => {
  const {appDisplayName, description} = args;
  const appDescription =
    description || `A full-stack application built with the Terreno framework.`;
  const pkgRef = composePackageGuidelinesForRules(rootPackageIds);
  const pkgSection =
    pkgRef.trim().length > 0
      ? `## Package Reference\n\n${pkgRef}`
      : "## Package Reference\n\n_(No package guidelines matched the selected packages.)_";

  return `# ${appDisplayName}

${appDescription}

## Project Structure

- **frontend/** - Expo/React Native frontend using @terreno/ui, @terreno/syncdb, and @terreno/rtk (SDK + Better Auth)
- **backend/** - Express/Mongoose backend using @terreno/api

## Development

Uses [Bun](https://bun.sh/) as the package manager.

\`\`\`bash
# Backend
cd backend && bun run dev    # Start backend on port 4000

# Frontend
cd frontend && bun run web   # Start web frontend
cd frontend && bun run sdk   # Regenerate SDK after backend changes
\`\`\`

## Code Style

### TypeScript/JavaScript
- Use ES module syntax and TypeScript for all code
- Prefer interfaces over types; avoid enums, use maps
- Prefer const arrow functions over \`function\` keyword
- Use descriptive variable names with auxiliary verbs (e.g., \`isLoading\`)
- Use camelCase directories (e.g., \`components/authWizard\`)
- Favor named exports
- Use the RORO pattern (Receive an Object, Return an Object)

### Dates and Time
- Always use Luxon instead of Date or dayjs

### Error Handling
- Check error conditions at start of functions and return early
- Limit nested if statements
- Use multiline syntax with curly braces for all conditionals

### Testing
- Use bun test with expect for testing

### Logging
- Frontend: Use \`console.info\`, \`console.debug\`, \`console.warn\`, or \`console.error\` for permanent logs
- Backend: Use \`logger.info/warn/error/debug\` for permanent logs
- Use \`console.log\` only for debugging (to be removed)

### Development Practices
- Don't apologize for errors: fix them
- Prioritize modularity, DRY, performance, and security
- Focus on readability over performance
- Write complete, functional code without TODOs when possible
- Comments should describe purpose, not effect

${pkgSection}

${REACT_BEST_PRACTICES_MARKDOWN}`;
};

const generateRootRulesFile = (
  args: BootstrapArgs,
  packageIds: readonly GuidelinePackageId[]
): string => {
  const {appDisplayName} = args;
  const body = buildSharedRootRulesMarkdownBody(args, filterGuidelineIdsForRootRules(packageIds));
  return `---
root: true
targets: ["cursor", "windsurf", "copilot"]
description: "${appDisplayName} root guidelines"
globs: ["**/*"]
---

${body}`;
};

const generateClaudeCodeRootRulesFile = (
  args: BootstrapArgs,
  packageIds: readonly GuidelinePackageId[]
): string => {
  const {appDisplayName} = args;
  const body = buildSharedRootRulesMarkdownBody(args, filterGuidelineIdsForRootRules(packageIds));
  return `---
localRoot: true
targets: ["claudecode"]
description: "${appDisplayName} Claude Code guidelines"
globs: ["**/*"]
---

${body}`;
};

const appendAdminBackendGuidelines = (packageIds: readonly GuidelinePackageId[]): string => {
  if (!packageIds.includes("admin-backend")) {
    return "";
  }
  const md = loadPackageGuidelineMarkdown("admin-backend");
  return md ? `\n\n${md}\n` : "";
};

const appendAdminFrontendGuidelines = (packageIds: readonly GuidelinePackageId[]): string => {
  if (!packageIds.includes("admin-frontend")) {
    return "";
  }
  const md = loadPackageGuidelineMarkdown("admin-frontend");
  return md ? `\n\n${md}\n` : "";
};

const generateBackendRulesFile = (
  args: BootstrapArgs,
  packageIds: readonly GuidelinePackageId[]
): string => {
  const {appDisplayName} = args;
  const admin = appendAdminBackendGuidelines(packageIds);
  return `---
root: true
targets: ["cursor", "windsurf", "copilot"]
description: "${appDisplayName} backend guidelines"
globs: ["**/*"]
---

# ${appDisplayName} Backend

Express/Mongoose backend using @terreno/api.

## Development

\`\`\`bash
bun run dev      # Start on port 4000
bun run test     # Run tests
bun run lint     # Lint code
\`\`\`

## Backend Conventions

- Use \`modelRouter\` for CRUD endpoints
- Use \`APIError\` for error responses: \`throw new APIError({status: 400, title: "Message"})\`
- Use \`logger.info/warn/error/debug\` for logging
- Use \`Model.findExactlyOne\` or \`Model.findOneOrNone\` (not \`Model.findOne\`)
- All model types live in \`src/types/models/\`
- In routes: \`req.user\` is \`UserDocument | undefined\`
${admin}## Runtime Configuration

Use \`AppConfig.getConfig()\` or \`AppConfig.getConfig("section.field")\` to read config values.
Use \`AppConfig.updateConfig(updates)\` to write. All values are persisted in MongoDB.

## Adding a New Model

1. Create model in \`src/models/yourModel.ts\`
2. Create types in \`src/types/models/yourModelTypes.ts\`
3. Export from \`src/models/index.ts\` and \`src/types/models/index.ts\`
4. Create route in \`src/api/yourModel.ts\`
5. Register route in \`src/server.ts\`
6. Optionally add to \`AdminApp\` in \`src/server.ts\` for admin panel access
`;
};

const _generateBackendClaudeRulesFile = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `---
localRoot: true
targets: ["claudecode"]
description: "${appDisplayName} backend Claude Code guidelines"
globs: ["**/*"]
---

# ${appDisplayName} Backend

Express/Mongoose backend using @terreno/api.

## Development

\`\`\`bash
bun run dev      # Start on port 4000
bun run test     # Run tests
bun run lint     # Lint code
\`\`\`

## Backend Conventions

- Use \`modelRouter\` for CRUD endpoints
- Use \`APIError\` for error responses: \`throw new APIError({status: 400, title: "Message"})\`
- Use \`logger.info/warn/error/debug\` for logging
- Use \`Model.findExactlyOne\` or \`Model.findOneOrNone\` (not \`Model.findOne\`)
- All model types live in \`src/types/models/\`
- In routes: \`req.user\` is \`UserDocument | undefined\`

## Adding a New Model

1. Create model in \`src/models/yourModel.ts\`
2. Create types in \`src/types/models/yourModelTypes.ts\`
3. Export from \`src/models/index.ts\` and \`src/types/models/index.ts\`
4. Create route in \`src/api/yourModel.ts\`
5. Register route in \`src/server.ts\`
`;
};

const generateFrontendRulesFile = (
  args: BootstrapArgs,
  packageIds: readonly GuidelinePackageId[]
): string => {
  const {appDisplayName} = args;
  const admin = appendAdminFrontendGuidelines(packageIds);
  return `---
root: true
targets: ["cursor", "windsurf", "copilot"]
description: "${appDisplayName} frontend guidelines"
globs: ["**/*"]
---

# ${appDisplayName} Frontend

Expo/React Native frontend using @terreno/ui, @terreno/syncdb, and @terreno/rtk.

## Development

\`\`\`bash
bun run web      # Start web frontend on port 8082
bun run sdk      # Regenerate SDK from backend OpenAPI spec
bun run lint     # Lint code
\`\`\`

## Frontend Conventions

- Use \`@terreno/syncdb/react\` hooks (\`useQuery\`, \`useMutate\`) for synced collection CRUD
- Use generated SDK hooks from \`@/store/openApiSdk\` for non-synced routes only
- Use @terreno/ui components (Box, Page, Button, TextField, etc.)
- Never modify \`openApiSdk.ts\` manually - regenerate with \`bun run sdk\`
- Use Luxon for date operations
- Better Auth session: \`generateBetterAuthSlice\` + \`lib/betterAuth.ts\`
${admin}## Expo SDK upgrades

- For Expo/React Native dependency upgrades, install and use the official \`upgrading-expo\` skill from \`expo/skills\` (\`bunx skills add expo/skills\` when using the Skills CLI). It covers \`expo install\`, doctor, caches, and SDK breaking changes.
- Terreno-specific upgrade notes ship with \`@terreno/mcp\` as bundled markdown; call the \`terreno_get_upgrade_guide\` tool (hosted Terreno MCP) for lockstep \`@terreno/*\` release notes.

## MCP servers (dev)

- **terreno** (HTTP): codegen, docs search, bootstrap tools.
- **terreno-local** (stdio): Mongo introspection, dev logs, RTK state (via \`registerTerrenoDevStore\`).
- **expo** (HTTP): Expo docs + local simulator automation when \`EXPO_UNSTABLE_MCP_SERVER=1\` dev server is running.
- **playwright**: web UI automation for \`expo start --web\`.

## Adding a New Screen

1. Regenerate SDK if backend changed: \`bun run sdk\`
2. Create screen in \`app/\` directory
3. Use @terreno/ui components for layout
4. Use SDK hooks for non-synced routes; use syncdb hooks for synced collections
`;
};

const _generateFrontendClaudeRulesFile = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `---
localRoot: true
targets: ["claudecode"]
description: "${appDisplayName} frontend Claude Code guidelines"
globs: ["**/*"]
---

# ${appDisplayName} Frontend

Expo/React Native frontend using @terreno/ui, @terreno/syncdb, and @terreno/rtk.

## Development

\`\`\`bash
bun run web      # Start web frontend on port 8082
bun run sdk      # Regenerate SDK from backend OpenAPI spec
bun run lint     # Lint code
\`\`\`

## Frontend Conventions

- Use \`@terreno/syncdb/react\` hooks for synced collection CRUD
- Use generated SDK hooks from \`@/store/openApiSdk\` for non-synced routes only
- Use @terreno/ui components (Box, Page, Button, TextField, etc.)
- Never modify \`openApiSdk.ts\` manually - regenerate with \`bun run sdk\`
- Use Luxon for date operations
- Better Auth session: \`generateBetterAuthSlice\` + \`lib/betterAuth.ts\`

## Adding a New Screen

1. Regenerate SDK if backend changed: \`bun run sdk\`
2. Create screen in \`app/\` directory
3. Use @terreno/ui components for layout
4. Use SDK hooks for non-synced routes; use syncdb hooks for synced collections
`;
};

interface AiRulesFile {
  path: string;
  content: string;
}

const generateAiRulesFiles = (args: BootstrapAiRulesArgs): AiRulesFile[] => {
  const packageIds = resolveBootstrapGuidelinePackages(args.packages);
  // Strip frontmatter for direct output files
  const stripFrontmatter = (content: string): string => {
    return content.replace(/^---[\s\S]*?---\n\n?/, "");
  };

  const backendContent = stripFrontmatter(generateBackendRulesFile(args, packageIds));
  const frontendContent = stripFrontmatter(generateFrontendRulesFile(args, packageIds));

  return [
    // .rulesync/rules/ source files (these are the source of truth for root)
    {content: generateRootRulesFile(args, packageIds), path: ".rulesync/rules/00-root.md"},
    {
      content: generateClaudeCodeRootRulesFile(args, packageIds),
      path: ".rulesync/rules/01-claudecode-root.md",
    },

    // Direct output files for backend (AGENTS.md and CLAUDE.md in backend/)
    {content: backendContent, path: "backend/AGENTS.md"},
    {content: backendContent, path: "backend/CLAUDE.md"},

    // Direct output files for frontend (AGENTS.md and CLAUDE.md in frontend/)
    {content: frontendContent, path: "frontend/AGENTS.md"},
    {content: frontendContent, path: "frontend/CLAUDE.md"},

    // Rulesync config (only syncs root level files)
    {content: generateRulesyncConfig(), path: "rulesync.jsonc"},
  ];
};

const handleBootstrapAiRulesToolCall = (
  args: Record<string, unknown>
): {content: Array<{type: "text"; text: string}>} => {
  const bootstrapArgs = args as unknown as BootstrapAiRulesArgs;

  if (!bootstrapArgs.appName || !bootstrapArgs.appDisplayName) {
    return {
      content: [
        {
          text: "Error: appName and appDisplayName are required parameters",
          type: "text",
        },
      ],
    };
  }

  const files = generateAiRulesFiles(bootstrapArgs);

  const fileList = files.map((f) => `- \`${f.path}\``).join("\n");

  const instructions = `# Bootstrap AI Rules for ${bootstrapArgs.appDisplayName}

## Files to Create

The following AI coding assistant configuration files need to be created:

${fileList}

## Instructions

1. **Create all the files listed above.** Each file's content is provided below.

2. **Install rulesync** (required for syncing root-level rules to all AI tools):
   \`\`\`bash
   npm install -g rulesync
   \`\`\`

3. **Run rulesync to generate root-level AI tool configs:**
   \`\`\`bash
   rulesync sync
   \`\`\`
   
   This generates root-level files from \`.rulesync/rules/\`:
   - \`.cursorrules\`, \`.windsurfrules\`, \`.github/copilot-instructions.md\`, \`.claude/CLAUDE.local.md\`, \`AGENTS.md\`

## How It Works

- **\`.rulesync/rules/\`** - Source of truth for root-level AI coding guidelines
- **\`rulesync.jsonc\`** - Configuration for rulesync tool (root only)
- **\`backend/AGENTS.md\` & \`backend/CLAUDE.md\`** - Direct context files for backend
- **\`frontend/AGENTS.md\` & \`frontend/CLAUDE.md\`** - Direct context files for frontend

## Keeping Rules Updated

- **Root rules**: Edit \`.rulesync/rules/\` and run \`rulesync sync\`
- **Backend/Frontend rules**: Edit \`backend/AGENTS.md\` or \`frontend/AGENTS.md\` directly (and copy to CLAUDE.md)

---

## File Contents

`;

  const fileContents = files
    .map((f) => {
      const lang = f.path.endsWith(".json") || f.path.endsWith(".jsonc") ? "json" : "markdown";
      return `### \`${f.path}\`

\`\`\`${lang}
${f.content}
\`\`\`
`;
    })
    .join("\n");

  return {
    content: [{text: instructions + fileContents, type: "text"}],
  };
};
export const handleBootstrapToolCall = (
  name: string,
  args: Record<string, unknown>
): {content: Array<{type: "text"; text: string}>} => {
  if (name === "terreno_bootstrap_ai_rules") {
    return handleBootstrapAiRulesToolCall(args);
  }

  if (name !== "terreno_bootstrap_app") {
    return {
      content: [{text: `Unknown bootstrap tool: ${name}`, type: "text"}],
    };
  }

  const bootstrapArgs = args as unknown as BootstrapToolArgs;

  if (!bootstrapArgs.appName || !bootstrapArgs.appDisplayName) {
    return {
      content: [
        {
          text: "Error: appName and appDisplayName are required parameters",
          type: "text",
        },
      ],
    };
  }

  if (!isValidAppName(bootstrapArgs.appName)) {
    return {
      content: [
        {
          text: "Error: appName must be kebab-case (lowercase letters, numbers, and hyphens)",
          type: "text",
        },
      ],
    };
  }

  const cliCommand = formatBootstrapCliCommand(bootstrapArgs);
  const targetDir =
    typeof bootstrapArgs.targetDir === "string" ? bootstrapArgs.targetDir : undefined;

  if (targetDir && isScaffoldWriteEnabled()) {
    const targetDirError = validateBootstrapTargetDir(targetDir);
    if (targetDirError) {
      return {
        content: [{text: `Error: ${targetDirError}`, type: "text"}],
      };
    }

    const writeResult = writeScaffold({
      appDisplayName: bootstrapArgs.appDisplayName,
      appName: bootstrapArgs.appName,
      description: bootstrapArgs.description,
      mcpServerUrl: bootstrapArgs.mcpServerUrl,
      parentDir: targetDir,
    });

    if (!writeResult.success) {
      return {
        content: [
          {text: `Error: ${writeResult.error ?? "Failed to write scaffold"}`, type: "text"},
        ],
      };
    }

    const nextSteps = writeResult.nextSteps.map((step) => `- \`${step}\``).join("\n");

    return {
      content: [
        {
          text: `# Scaffold written: ${writeResult.targetPath}

Wrote the same files as \`create-terreno-app\` to disk.

## CLI (equivalent)

\`\`\`bash
${cliCommand}
\`\`\`

## Next steps

${nextSteps}
`,
          type: "text",
        },
      ],
    };
  }

  const files = generateAllFiles(bootstrapArgs);

  const fileList = files.map((f) => `- \`${f.path}\``).join("\n");

  const instructions = `# Bootstrap ${bootstrapArgs.appDisplayName}

## Recommended: use the CLI

\`\`\`bash
${cliCommand}
\`\`\`

Or create files manually from the dump below.

## Files to Create

The following files need to be created for your new Terreno application:

${fileList}

## Instructions

1. **Create the project directory** (if not using the CLI above):
   \`\`\`bash
   mkdir ${bootstrapArgs.appName}
   cd ${bootstrapArgs.appName}
   \`\`\`

2. **Create all the files listed above.** Each file's content is provided below.

   No \`assets/\` directory is needed: \`@terreno/ui\` ships the Nunito and Titillium Web
   fonts it renders with, and \`app.json\` leaves \`icon\`/\`splash\`/\`favicon\` unset so Expo
   uses its built-in defaults. Add your own branding assets whenever you're ready and
   point \`app.json\` at them then.

3. **Install dependencies:**
   \`\`\`bash
   cd backend && bun install
   cd ../frontend && bun install
   \`\`\`

4. **Start MongoDB as a replica set** (required for realtime/sync):
   \`\`\`bash
   # Using Docker (single-node replica set):
   docker run -d --name mongo -p 27017:27017 mongo:7 --replSet rs0
   docker exec mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
   \`\`\`

5. **Start the backend:**
   \`\`\`bash
   cd backend && bun run dev
   \`\`\`

7. **In a new terminal, seed login-ready development users:**
   \`\`\`bash
   cd backend && bun run seed
   # Re-run safely after seed definitions change, or use --reset to reset managed data.
   \`\`\`

8. **In a new terminal, regenerate and start the frontend:**
   \`\`\`bash
   cd frontend
   bun run sdk  # Generate SDK from backend
   bun run web  # Start web frontend
   \`\`\`

9. **Open http://localhost:8082** and sign in as \`test@example.com\` / \`testpassword123\`

## MCP Integration

The project is configured to use the Terreno MCP server at:
\`${bootstrapArgs.mcpServerUrl || "https://mcp.terreno.flourish.health"}\`

This provides AI assistance with:
- Generating models and routes
- Creating screens and forms
- Following Terreno patterns

---

## File Contents

`;

  const fileContents = files
    .map((f) => {
      const lang = getFenceLanguage(f.path);
      return `### \`${f.path}\`

\`\`\`${lang}
${f.content}
\`\`\`
`;
    })
    .join("\n");

  return {
    content: [{text: instructions + fileContents, type: "text"}],
  };
};

// Prompt for bootstrapping
interface BootstrapPrompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export const bootstrapPrompts: BootstrapPrompt[] = [
  {
    arguments: [
      {
        description: "Application name in kebab-case (e.g., 'my-app', 'todo-manager')",
        name: "appName",
        required: true,
      },
      {
        description: "Human-readable display name (e.g., 'My App', 'Todo Manager')",
        name: "appDisplayName",
        required: true,
      },
    ],
    description:
      "Bootstrap a new Terreno full-stack application with frontend, backend, Cursor rules, and MCP integration",
    name: "terreno_bootstrap",
  },
];

export const handleBootstrapPromptRequest = (
  name: string,
  args: Record<string, string>
): {messages: Array<{role: "user"; content: {type: "text"; text: string}}>} => {
  if (name !== "terreno_bootstrap") {
    return {
      messages: [
        {
          content: {
            text: `Unknown bootstrap prompt: ${name}`,
            type: "text",
          },
          role: "user",
        },
      ],
    };
  }

  const {appName, appDisplayName} = args;

  const prompt = `Please bootstrap a new Terreno application with the following details:

- **App Name** (kebab-case): ${appName}
- **Display Name**: ${appDisplayName}

Use the \`terreno_bootstrap_app\` tool to generate all the necessary files for the application.

After generating the files:
1. Create all directories and files as specified (no \`assets/\` directory is required)
2. Install dependencies with \`bun install\`
3. Start MongoDB
4. Start the backend with \`bun run dev\`
5. Generate the SDK with \`bun run sdk\` in the frontend
6. Start the frontend with \`bun run web\`

The application should include:
- Better Auth login (email/password via \`@terreno/ui\` LoginScreen)
- Tab-based navigation with Home and Profile screens
- \`@terreno/syncdb\` client wired in the root layout (empty \`SYNC_COLLECTIONS\` until you add synced models)
- Redux with Better Auth session + RTK Query SDK for non-synced routes
- OpenAPI SDK generation from backend spec
- Cursor rules for AI assistance
- MCP integration for development assistance

**IMPORTANT: After completing the terreno_bootstrap_app steps, also run the \`terreno_bootstrap_ai_rules\` tool** with the same appName and appDisplayName to set up AI coding assistant rules for Cursor, Windsurf, Claude Code, and GitHub Copilot. This will create:
- AGENTS.md files for each directory
- .cursorrules and .windsurfrules files
- GitHub Copilot instructions
- Claude Code local rules
- rulesync.jsonc for keeping rules in sync

Then install rulesync to keep AI rules synchronized:
\`\`\`bash
npm install -g rulesync
\`\`\``;

  return {
    messages: [
      {
        content: {
          text: prompt,
          type: "text",
        },
        role: "user",
      },
    ],
  };
};
