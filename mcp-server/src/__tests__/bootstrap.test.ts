import {describe, expect, test} from "bun:test";
import {
  bootstrapPrompts,
  bootstrapTools,
  handleBootstrapPromptRequest,
  handleBootstrapToolCall,
} from "../bootstrap.js";

describe("bootstrap", () => {
  describe("bootstrapTools", () => {
    test("should export bootstrap_app and bootstrap_ai_rules", () => {
      const names = bootstrapTools.map((t) => t.name);
      expect(names).toContain("bootstrap_app");
      expect(names).toContain("bootstrap_ai_rules");
    });

    test("should have valid input schema structure", () => {
      for (const tool of bootstrapTools) {
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.required).toContain("appName");
        expect(tool.inputSchema.required).toContain("appDisplayName");
      }
    });
  });

  describe("bootstrapPrompts", () => {
    test("should export bootstrap_terreno_app prompt", () => {
      const names = bootstrapPrompts.map((p) => p.name);
      expect(names).toContain("bootstrap_terreno_app");
    });

    test("should have required arguments", () => {
      const prompt = bootstrapPrompts.find((p) => p.name === "bootstrap_terreno_app");
      expect(prompt).toBeDefined();
      const argNames = prompt?.arguments.map((a) => a.name);
      expect(argNames).toContain("appName");
      expect(argNames).toContain("appDisplayName");
    });
  });

  describe("handleBootstrapToolCall - bootstrap_app", () => {
    test("should return error when appName is missing", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "My App",
      });
      expect(result.content[0].text).toContain("Error");
      expect(result.content[0].text).toContain("required");
    });

    test("should return error when appDisplayName is missing", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appName: "my-app",
      });
      expect(result.content[0].text).toContain("Error");
    });

    test("should return all expected files with required args", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "My App",
        appName: "my-app",
      });
      const text = result.content[0].text;

      expect(text).toContain("# Bootstrap My App");
      expect(text).toContain(".cursorrules");
      expect(text).toContain(".cursor/mcp.json");
      expect(text).toContain("CLAUDE.md");

      // Backend files
      expect(text).toContain("backend/package.json");
      expect(text).toContain("backend/tsconfig.json");
      expect(text).toContain("backend/biome.jsonc");
      expect(text).toContain("backend/src/index.ts");
      expect(text).toContain("backend/src/server.ts");
      expect(text).toContain("backend/src/utils/database.ts");
      expect(text).toContain("backend/src/models/modelPlugins.ts");
      expect(text).toContain("backend/src/models/user.ts");
      expect(text).toContain("backend/src/models/appConfiguration.ts");
      expect(text).toContain("backend/src/models/index.ts");
      expect(text).toContain("backend/src/api/users.ts");
      expect(text).toContain("backend/src/types/index.ts");
      expect(text).toContain("backend/src/types/models/userTypes.ts");

      // Frontend files
      expect(text).toContain("frontend/package.json");
      expect(text).toContain("frontend/app.json");
      expect(text).toContain("frontend/tsconfig.json");
      expect(text).toContain("frontend/tsconfig.codegen.json");
      expect(text).toContain("frontend/biome.jsonc");
      expect(text).toContain("frontend/openapi-config.ts");
      expect(text).toContain("frontend/scripts/generate-sdk.ts");
      expect(text).toContain("frontend/app/_layout.tsx");
      expect(text).toContain("frontend/app/login.tsx");
      expect(text).toContain("frontend/app/+not-found.tsx");
      expect(text).toContain("frontend/app/(tabs)/_layout.tsx");
      expect(text).toContain("frontend/app/(tabs)/index.tsx");
      expect(text).toContain("frontend/app/(tabs)/profile.tsx");
      expect(text).toContain("frontend/app/(tabs)/admin/_layout.tsx");
      expect(text).toContain("frontend/app/(tabs)/admin/index.tsx");
      expect(text).toContain("frontend/app/(tabs)/admin/configuration.tsx");
      expect(text).toContain("frontend/store/index.ts");
      expect(text).toContain("frontend/store/appState.ts");
      expect(text).toContain("frontend/store/errors.ts");
      expect(text).toContain("frontend/store/sdk.ts");
      expect(text).toContain("frontend/store/openApiSdk.ts");
      expect(text).toContain("frontend/constants/theme.ts");
      expect(text).toContain("frontend/utils/index.ts");
      expect(text).toContain("frontend/.env");

      // Workflows
      expect(text).toContain(".github/workflows/backend-ci.yml");
      expect(text).toContain(".github/workflows/frontend-ci.yml");
    });

    test("should include setup instructions", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "Test App",
        appName: "test-app",
      });
      const text = result.content[0].text;

      expect(text).toContain("mkdir test-app");
      expect(text).toContain("cd test-app");
      expect(text).toContain("bun install");
      expect(text).toContain("docker run");
      expect(text).toContain("SpaceMono");
      expect(text).toContain("bun run dev");
      expect(text).toContain("bun run sdk");
      expect(text).toContain("http://localhost:8082");
    });

    test("should use custom MCP server URL when provided", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "Custom App",
        appName: "custom-app",
        mcpServerUrl: "https://custom.mcp.example.com",
      });
      expect(result.content[0].text).toContain("https://custom.mcp.example.com");
    });

    test("should use default MCP server URL when not provided", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "Default App",
        appName: "default-app",
      });
      expect(result.content[0].text).toContain("mcp.terreno.flourish.health");
    });

    test("should include generated backend server code", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "Code App",
        appName: "code-app",
      });
      const text = result.content[0].text;

      expect(text).toContain("TerrenoApp");
      expect(text).toContain("AdminApp");
      expect(text).toContain("connectToMongoDB");
      expect(text).toContain("userRouter");
    });

    test("should include generated frontend code", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "FE App",
        appName: "fe-app",
      });
      const text = result.content[0].text;

      expect(text).toContain("generateAuthSlice");
      expect(text).toContain("LoginScreen");
      expect(text).toContain("TabLayout");
      expect(text).toContain("HomeScreen");
      expect(text).toContain("ProfileScreen");
      expect(text).toContain("useEmailLoginMutation");
      expect(text).toContain("useEmailSignUpMutation");
      expect(text).toContain("persistReducer");
      expect(text).toContain("primitives");
      expect(text).toContain("AdminModelList");
    });

    test("should generate valid JSON in mcp.json settings", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "JSON App",
        appName: "json-app",
      });
      const text = result.content[0].text;
      const match = text.match(/### `\.cursor\/mcp\.json`\n\n```json\n([\s\S]*?)\n```/);
      expect(match).toBeTruthy();
      if (match) {
        const parsed = JSON.parse(match[1]);
        expect(parsed.mcpServers.terreno).toBeDefined();
        expect(parsed.mcpServers.terreno.type).toBe("http");
      }
    });

    test("should use app name in workflow files", () => {
      const result = handleBootstrapToolCall("bootstrap_app", {
        appDisplayName: "Workflow App",
        appName: "workflow-app",
      });
      const text = result.content[0].text;
      expect(text).toContain("Backend CI");
      expect(text).toContain("Frontend CI");
    });
  });

  describe("handleBootstrapToolCall - bootstrap_ai_rules", () => {
    test("should return error when appName is missing", () => {
      const result = handleBootstrapToolCall("bootstrap_ai_rules", {
        appDisplayName: "My App",
      });
      expect(result.content[0].text).toContain("Error");
    });

    test("should return error when appDisplayName is missing", () => {
      const result = handleBootstrapToolCall("bootstrap_ai_rules", {
        appName: "my-app",
      });
      expect(result.content[0].text).toContain("Error");
    });

    test("should generate all AI rules files with required args", () => {
      const result = handleBootstrapToolCall("bootstrap_ai_rules", {
        appDisplayName: "Rules App",
        appName: "rules-app",
      });
      const text = result.content[0].text;

      expect(text).toContain("# Bootstrap AI Rules for Rules App");
      expect(text).toContain(".rulesync/rules/00-root.md");
      expect(text).toContain(".rulesync/rules/01-claudecode-root.md");
      expect(text).toContain("backend/AGENTS.md");
      expect(text).toContain("backend/CLAUDE.md");
      expect(text).toContain("frontend/AGENTS.md");
      expect(text).toContain("frontend/CLAUDE.md");
      expect(text).toContain("rulesync.jsonc");
    });

    test("should include setup instructions for rulesync", () => {
      const result = handleBootstrapToolCall("bootstrap_ai_rules", {
        appDisplayName: "R App",
        appName: "r-app",
      });
      expect(result.content[0].text).toContain("rulesync sync");
      expect(result.content[0].text).toContain("npm install -g rulesync");
    });

    test("should strip frontmatter from backend/frontend AGENTS files", () => {
      const result = handleBootstrapToolCall("bootstrap_ai_rules", {
        appDisplayName: "Strip App",
        appName: "strip-app",
      });
      const text = result.content[0].text;

      // The AGENTS.md content should not contain frontmatter markers when shown
      const backendAgentsMatch = text.match(
        /### `backend\/AGENTS\.md`\n\n```markdown\n([\s\S]*?)\n```/
      );
      expect(backendAgentsMatch).toBeTruthy();
      if (backendAgentsMatch) {
        expect(backendAgentsMatch[1].startsWith("---")).toBe(false);
        expect(backendAgentsMatch[1]).toContain("Strip App Backend");
      }
    });
  });

  describe("handleBootstrapToolCall - unknown", () => {
    test("should return error for unknown bootstrap tool", () => {
      const result = handleBootstrapToolCall("bootstrap_unknown", {});
      expect(result.content[0].text).toContain("Unknown bootstrap tool");
    });
  });

  describe("handleBootstrapPromptRequest", () => {
    test("should generate bootstrap prompt", () => {
      const result = handleBootstrapPromptRequest("bootstrap_terreno_app", {
        appDisplayName: "Prompt App",
        appName: "prompt-app",
      });
      const text = result.messages[0].content.text;

      expect(text).toContain("prompt-app");
      expect(text).toContain("Prompt App");
      expect(text).toContain("bootstrap_app");
      expect(text).toContain("bootstrap_ai_rules");
      expect(text).toContain("rulesync");
    });

    test("should return unknown message for unknown prompt", () => {
      const result = handleBootstrapPromptRequest("unknown_prompt", {});
      expect(result.messages[0].content.text).toContain("Unknown bootstrap prompt");
    });
  });
});
