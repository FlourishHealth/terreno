import {describe, test} from "bun:test";
import {assert} from "chai";

import packageJson from "../../package.json";
import {generateAllFiles, PLAYWRIGHT_MCP_PACKAGE_VERSION} from "../generate.js";

const EXPECTED_PATHS = [
  ".cursor/mcp.json",
  ".cursorrules",
  ".github/workflows/backend-ci.yml",
  ".github/workflows/frontend-ci.yml",
  ".gitignore",
  "CLAUDE.md",
  "backend/.env",
  "backend/biome.jsonc",
  "backend/package.json",
  "backend/src/api/users.ts",
  "backend/src/index.ts",
  "backend/src/models/appConfiguration.ts",
  "backend/src/models/index.ts",
  "backend/src/models/modelPlugins.ts",
  "backend/src/models/user.ts",
  "backend/src/scripts/seed.ts",
  "backend/src/server.ts",
  "backend/src/types/index.ts",
  "backend/src/types/models/index.ts",
  "backend/src/types/models/userTypes.ts",
  "backend/src/utils/betterAuthConfig.ts",
  "backend/src/utils/database.ts",
  "backend/tsconfig.json",
  "frontend/.env",
  "frontend/app.json",
  "frontend/app/(tabs)/_layout.tsx",
  "frontend/app/(tabs)/admin/_layout.tsx",
  "frontend/app/(tabs)/admin/configuration.tsx",
  "frontend/app/(tabs)/admin/index.tsx",
  "frontend/app/(tabs)/index.tsx",
  "frontend/app/(tabs)/profile.tsx",
  "frontend/app/+not-found.tsx",
  "frontend/app/_layout.tsx",
  "frontend/app/login.tsx",
  "frontend/app/signup.tsx",
  "frontend/biome.jsonc",
  "frontend/constants/theme.ts",
  "frontend/lib/betterAuth.ts",
  "frontend/metro.config.js",
  "frontend/openapi-config.ts",
  "frontend/package.json",
  "frontend/scripts/generate-sdk.ts",
  "frontend/store/appState.ts",
  "frontend/store/errors.ts",
  "frontend/store/index.ts",
  "frontend/store/openApiSdk.ts",
  "frontend/store/sdk.ts",
  "frontend/store/syncdb.ts",
  "frontend/tsconfig.codegen.json",
  "frontend/tsconfig.json",
  "frontend/utils/index.ts",
];
const TERRENO_RANGE = `^${packageJson.version}`;

describe("generateAllFiles", () => {
  test("returns backend, frontend, CI, MCP, and seed files", () => {
    const files = generateAllFiles({
      appDisplayName: "My App",
      appName: "my-app",
    });
    const paths = files.map((file) => file.path);

    assert.deepEqual(paths.toSorted(), EXPECTED_PATHS);
  });

  test("pins every generated @terreno/* dependency to ^PACKAGE_VERSION", () => {
    const files = generateAllFiles({
      appDisplayName: "Pin App",
      appName: "pin-app",
    });

    const backendPackageJson = JSON.parse(
      files.find((file) => file.path === "backend/package.json")?.content ?? "{}"
    ) as {dependencies: Record<string, string>};
    const frontendPackageJson = JSON.parse(
      files.find((file) => file.path === "frontend/package.json")?.content ?? "{}"
    ) as {dependencies: Record<string, string>};

    assert.deepInclude(backendPackageJson.dependencies, {
      "@terreno/admin-backend": TERRENO_RANGE,
      "@terreno/api": TERRENO_RANGE,
    });
    assert.deepInclude(frontendPackageJson.dependencies, {
      "@terreno/admin-frontend": TERRENO_RANGE,
      "@terreno/rtk": TERRENO_RANGE,
      "@terreno/syncdb": TERRENO_RANGE,
      "@terreno/ui": TERRENO_RANGE,
    });
  });

  test("generates the default MCP server configuration", () => {
    const files = generateAllFiles({
      appDisplayName: "Default MCP",
      appName: "default-mcp",
    });
    const mcpJson = JSON.parse(
      files.find((file) => file.path === ".cursor/mcp.json")?.content ?? "{}"
    ) as {
      mcpServers: Record<string, {args?: string[]; command?: string; type?: string; url?: string}>;
    };

    assert.equal(mcpJson.mcpServers.terreno.url, "https://mcp.terreno.flourish.health/mcp");
    assert.deepEqual(mcpJson.mcpServers.expo, {
      type: "http",
      url: "https://mcp.expo.dev/mcp",
    });
    assert.deepEqual(mcpJson.mcpServers.playwright.args, [
      "-y",
      `@playwright/mcp@${PLAYWRIGHT_MCP_PACKAGE_VERSION}`,
    ]);
    assert.equal(mcpJson.mcpServers["terreno-local"].command, "bunx");
    assert.deepEqual(mcpJson.mcpServers["terreno-local"].args, ["terreno-mcp-local"]);
  });

  test("uses a custom MCP server URL", () => {
    const files = generateAllFiles({
      appDisplayName: "Custom MCP",
      appName: "custom-mcp",
      mcpServerUrl: "https://custom.mcp.example.com",
    });
    const mcpJson = JSON.parse(
      files.find((file) => file.path === ".cursor/mcp.json")?.content ?? "{}"
    ) as {mcpServers: {terreno: {url: string}}};

    assert.equal(mcpJson.mcpServers.terreno.url, "https://custom.mcp.example.com/mcp");
  });
});
