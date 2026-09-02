import {describe, it} from "bun:test";
import {assert} from "chai";
import {join, resolve} from "node:path";

import {parseLcov} from "./check-coverage";
import {
  bunTestFileArgs,
  coverageRunArgs,
  evaluateNewFileCoverage,
  expandCoverageRunArgs,
  groupFilesByWorkspace,
  isCoverageSourceFile,
  parseNewFileCoverageArgs,
} from "./check-new-file-coverage";

describe("parseNewFileCoverageArgs", () => {
  it("requires callers to provide a base and defaults to 90 percent", () => {
    assert.deepEqual(parseNewFileCoverageArgs(["--base=abc123"]), {
      base: "abc123",
      threshold: 90,
    });
  });

  it("accepts a custom threshold", () => {
    assert.deepEqual(parseNewFileCoverageArgs(["--base=abc123", "--threshold=95"]), {
      base: "abc123",
      threshold: 95,
    });
  });
});

describe("isCoverageSourceFile", () => {
  it("includes implementation TypeScript files", () => {
    assert.isTrue(isCoverageSourceFile("api/src/newRoute.ts"));
    assert.isTrue(isCoverageSourceFile("ui/src/NewComponent.tsx"));
  });

  it("excludes tests, stories, generated SDKs, and non-source files", () => {
    assert.isFalse(isCoverageSourceFile("api/src/newRoute.test.ts"));
    assert.isFalse(isCoverageSourceFile("ui/src/NewComponent.stories.tsx"));
    assert.isFalse(isCoverageSourceFile("example-frontend/store/openApiSdk.ts"));
    assert.isFalse(isCoverageSourceFile("api/src/readme.md"));
    assert.isFalse(isCoverageSourceFile("api/src/types/authToken.ts"));
    assert.isFalse(isCoverageSourceFile("demo/story-config/LoginScreen.config.tsx"));
  });

  it("excludes Expo Router route-structural entry files but keeps other app modules", () => {
    assert.isFalse(isCoverageSourceFile("example-frontend/app/admin/comms/index.tsx"));
    assert.isFalse(isCoverageSourceFile("example-frontend/app/admin/comms/[id].tsx"));
    assert.isFalse(isCoverageSourceFile("admin-spa/app/comms/index.tsx"));
    assert.isFalse(isCoverageSourceFile("admin-spa/app/[model]/_layout.tsx"));
    assert.isFalse(isCoverageSourceFile("admin-spa/app/+not-found.tsx"));
    assert.isTrue(isCoverageSourceFile("example-frontend/app/admin/SyncLabScreen.tsx"));
    assert.isFalse(isCoverageSourceFile("example-frontend/app/forgotPassword.tsx"));
    assert.isFalse(isCoverageSourceFile("example-frontend/app/resetPassword.tsx"));
    assert.isFalse(isCoverageSourceFile("example-frontend/app/verifyEmail.tsx"));
    assert.isTrue(isCoverageSourceFile("example-frontend/store/index.ts"));
  });
});

describe("groupFilesByWorkspace", () => {
  it("groups only files that belong to declared workspaces", () => {
    assert.deepEqual(
      groupFilesByWorkspace({
        files: ["scripts/tool.ts", "ui/src/New.tsx", "api/src/new.ts"],
        workspaces: new Set(["api", "ui"]),
      }),
      [
        {files: ["api/src/new.ts"], packageName: "api"},
        {files: ["ui/src/New.tsx"], packageName: "ui"},
      ]
    );
  });
});

describe("evaluateNewFileCoverage", () => {
  const repoRoot = "/repo";
  const packageRoot = "/repo/api";

  it("passes files whose function and line coverage meet 90 percent", () => {
    const coverage = parseLcov(
      [
        "SF:src/new.ts",
        "FN:1,covered",
        "FNDA:1,covered",
        "FNF:1",
        "FNH:1",
        "DA:1,1",
        "DA:2,1",
        "LF:2",
        "LH:2",
        "end_of_record",
      ].join("\n")
    );
    assert.deepEqual(
      evaluateNewFileCoverage({
        coverage,
        files: ["api/src/new.ts"],
        packageRoot,
        repoRoot,
        threshold: 90,
      }),
      []
    );
  });

  it("fails files below the threshold", () => {
    const coverage = parseLcov(
      [
        "SF:/repo/api/src/new.ts",
        "FN:1,covered",
        "FN:5,missed",
        "FNDA:1,covered",
        "FNDA:0,missed",
        "FNF:2",
        "FNH:1",
        "DA:1,1",
        "DA:2,0",
        "LF:2",
        "LH:1",
        "end_of_record",
      ].join("\n")
    );
    const failures = evaluateNewFileCoverage({
      coverage,
      files: ["api/src/new.ts"],
      packageRoot,
      repoRoot,
      threshold: 90,
    });
    assert.lengthOf(failures, 1);
    assert.deepEqual(failures[0].summary, {functions: 50, lines: 50});
  });

  it("treats files missing from LCOV as uncovered", () => {
    assert.deepEqual(
      evaluateNewFileCoverage({
        coverage: new Map(),
        files: ["api/src/new.ts"],
        packageRoot,
        repoRoot,
        threshold: 90,
      }),
      [{path: "api/src/new.ts", summary: null}]
    );
  });
});

describe("coverageRunArgs", () => {
  it("reuses explicit bun test file globs so Playwright specs stay out", () => {
    assert.deepEqual(bunTestFileArgs("bun test ./**/*.test.ts ./**/*.test.tsx"), [
      "./**/*.test.ts",
      "./**/*.test.tsx",
    ]);
    assert.deepEqual(
      coverageRunArgs({
        hasSrcDir: false,
        packageName: "example-frontend",
        testScript: "bun test ./**/*.test.ts ./**/*.test.tsx",
      }),
      ["./**/*.test.ts", "./**/*.test.tsx"]
    );
  });

  it("ignores flags and chained isolated-test shells", () => {
    assert.deepEqual(bunTestFileArgs("bun test --max-concurrency=1 src/"), ["src/"]);
    assert.deepEqual(bunTestFileArgs("bun test && bun test ./src/isolated/*.isolated.ts"), []);
  });

  it("falls back to src or unit-test globs when the script has no paths", () => {
    assert.deepEqual(
      coverageRunArgs({hasSrcDir: true, packageName: "api", testScript: "bun test"}),
      ["src"]
    );
    assert.deepEqual(
      coverageRunArgs({hasSrcDir: false, packageName: "example-frontend"}),
      ["./**/*.test.ts", "./**/*.test.tsx"]
    );
    assert.deepEqual(
      coverageRunArgs({hasSrcDir: true, packageName: "mcp-server", testScript: "bun test"}),
      ["--max-concurrency=1", "src"]
    );
  });
});

describe("expandCoverageRunArgs", () => {
  const repoRoot = resolve(import.meta.dir, "..");

  it("passes through flags and plain directories untouched", () => {
    assert.deepEqual(
      expandCoverageRunArgs({
        args: ["--max-concurrency=1", "src"],
        packageRoot: join(repoRoot, "api"),
      }),
      ["--max-concurrency=1", "src"]
    );
  });

  it("expands shell globs into real files so a direct bun spawn matches them", () => {
    const expanded = expandCoverageRunArgs({
      args: ["./**/*.test.ts"],
      packageRoot: join(repoRoot, "example-frontend"),
    });
    assert.isTrue(expanded.length > 0, "expected example-frontend unit tests to be found");
    assert.include(expanded, "store/errors.test.ts");
    for (const path of expanded) {
      assert.notInclude(path, "*");
      assert.notInclude(path, "node_modules");
    }
  });
});
