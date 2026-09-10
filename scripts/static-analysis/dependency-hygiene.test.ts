import {describe, test} from "bun:test";
import {join} from "node:path";
import {assert} from "chai";

const REPO_ROOT = join(import.meta.dir, "../..");

const UNUSED_DEV_DEPENDENCIES = new Map<string, string[]>([
  ["package.json", ["tsx"]],
  ["api/package.json", ["@types/bcrypt", "@types/cron", "@types/sinon", "sinon"]],
  ["example-backend/package.json", ["@types/lodash", "@types/winston", "mongodb"]],
  ["admin-backend/package.json", ["passport-local-mongoose"]],
  ["feature-flags/package.json", ["passport-local-mongoose"]],
  ["ai/package.json", ["winston"]],
  ["example-frontend/package.json", ["expo-mcp"]],
  [
    "demo/package.json",
    [
      "@babel/plugin-proposal-export-namespace-from",
      "@shopify/flash-list",
      "postcss",
      "prettier",
      "typedoc",
    ],
  ],
  [
    "ui/package.json",
    [
      "@expo/config-plugins",
      "@happy-dom/global-registrator",
      "@types/minimatch",
      "@types/react-datetime-picker",
      "@types/react-time-picker",
      "babel-preset-react-app",
      "prettier",
      "react-router",
      "react-router-dom",
    ],
  ],
]);

describe("dependency hygiene", (): void => {
  test("does not retain unused development dependencies", async (): Promise<void> => {
    for (const [manifestPath, dependencyNames] of UNUSED_DEV_DEPENDENCIES) {
      const manifest = (await Bun.file(join(REPO_ROOT, manifestPath)).json()) as {
        devDependencies?: Record<string, string>;
      };
      for (const dependencyName of dependencyNames) {
        assert.notProperty(
          manifest.devDependencies ?? {},
          dependencyName,
          `${manifestPath}: ${dependencyName}`
        );
      }
    }
  });
});
