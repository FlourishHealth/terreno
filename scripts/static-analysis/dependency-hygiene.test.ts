import {describe, test} from "bun:test";
import {join} from "node:path";
import {assert} from "chai";

const REPO_ROOT = join(import.meta.dir, "../..");

const UNUSED_DEV_DEPENDENCIES = new Map<string, string[]>([
  ["package.json", ["tsx"]],
  ["api/package.json", ["@types/bcrypt", "@types/cron", "@types/sinon", "sinon"]],
  ["example-backend/package.json", ["@types/lodash", "@types/winston", "mongodb"]],
  ["example-frontend/package.json", ["@types/lodash"]],
  ["admin-backend/package.json", ["passport-local-mongoose"]],
  ["feature-flags/package.json", ["passport-local-mongoose"]],
  ["ai/package.json", ["winston"]],
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

const UNUSED_RUNTIME_DEPENDENCIES = new Map<string, string[]>([
  [
    "example-backend/package.json",
    [
      "@google-cloud/logging",
      "@google-cloud/logging-winston",
      "@opentelemetry/instrumentation-mongoose",
      "lodash",
      "path-to-regexp",
      "qs",
    ],
  ],
  ["api/package.json", ["@sentry/profiling-node", "generaterr", "scmp"]],
  ["example-frontend/package.json", ["lodash"]],
  ["test/package.json", ["lodash"]],
  ["website/package.json", ["clsx"]],
]);

describe("dependency hygiene", (): void => {
  test("keeps the Knip baseline empty", async (): Promise<void> => {
    const baseline = (await Bun.file(
      join(REPO_ROOT, "scripts/static-analysis/knip-baseline.json")
    ).json()) as {issues: string[]};
    assert.deepEqual(baseline.issues, []);
  });

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

  test("does not retain unused runtime dependencies", async (): Promise<void> => {
    for (const [manifestPath, dependencyNames] of UNUSED_RUNTIME_DEPENDENCIES) {
      const manifest = (await Bun.file(join(REPO_ROOT, manifestPath)).json()) as {
        dependencies?: Record<string, string>;
      };
      for (const dependencyName of dependencyNames) {
        assert.notProperty(
          manifest.dependencies ?? {},
          dependencyName,
          `${manifestPath}: ${dependencyName}`
        );
      }
    }
  });

  test("keeps admin SPA e2e-only luxon in devDependencies", async (): Promise<void> => {
    const manifest = (await Bun.file(join(REPO_ROOT, "admin-spa/package.json")).json()) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.notProperty(manifest.dependencies ?? {}, "luxon");
    assert.property(manifest.devDependencies ?? {}, "luxon");
  });
});
