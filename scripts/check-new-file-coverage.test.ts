import {describe, it} from "bun:test";
import {assert} from "chai";
import {join} from "node:path";

import {parseLcov} from "./check-coverage";
import {
  bunTestFileArgs,
  coverageRunArgs,
  evaluateNewFileCoverage,
  expandCoverageFileArgs,
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

describe("expandCoverageFileArgs", () => {
  it("omits globs that match no files", () => {
    const expanded = expandCoverageFileArgs(
      ["./**/*.test.ts", "./**/*.test.tsx"],
      join(import.meta.dir, "..", "example-frontend")
    );
    assert.include(expanded, "./store/registerExpoPushToken.test.ts");
    assert.isFalse(expanded.some((path) => path.endsWith(".test.tsx")));
  });

  it("preserves bun flags and non-glob paths", () => {
    assert.deepEqual(expandCoverageFileArgs(["--max-concurrency=1", "src"], import.meta.dir), [
      "--max-concurrency=1",
      "src",
    ]);
  });
});
