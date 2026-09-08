import {describe, test} from "bun:test";
import {assert} from "chai";

import {
  compareKnipBaseline,
  fingerprintKnipReport,
  groupFilesByBiomeDirectory,
  type KnipBaseline,
  parseChangedFileOutput,
  selectAnalyzableFiles,
} from "./lib";

describe("static-analysis helpers", (): void => {
  test("parses null-separated Git file output", (): void => {
    assert.deepEqual(parseChangedFileOutput("api/src/a.ts\0ui/src/b.tsx\0"), [
      "api/src/a.ts",
      "ui/src/b.tsx",
    ]);
  });

  test("selects unique existing files supported by Biome", (): void => {
    const files = selectAnalyzableFiles(
      ["README.md", "api/src/a.ts", "api/src/a.ts", "missing.ts", "package.json"],
      (file): boolean => file !== "missing.ts"
    );

    assert.deepEqual(files, ["api/src/a.ts", "package.json"]);
  });

  test("groups files under their nearest workspace Biome config", (): void => {
    const runs = groupFilesByBiomeDirectory({
      doesConfigExist: (path): boolean =>
        path === "/repo/api/biome.jsonc" || path === "/repo/scripts/biome.jsonc",
      files: ["package.json", "api/src/a.ts", "scripts/check.ts"],
      repoRoot: "/repo",
    });

    assert.deepEqual(runs, [
      {cwd: "/repo/api", files: ["src/a.ts"]},
      {cwd: "/repo/scripts", files: ["check.ts"]},
    ]);
  });

  test("fingerprints Knip issues without unstable source positions", (): void => {
    const issues = fingerprintKnipReport({
      mode: "default",
      report: {
        issues: [
          {
            exports: [{col: 4, line: 10, name: "unusedExport"}],
            file: "src/example.ts",
            files: [],
          },
        ],
      },
    });

    assert.deepEqual(issues, ["default:exports:src/example.ts:unusedExport"]);
  });

  test("ratchets only findings absent from the baseline", (): void => {
    const baseline: KnipBaseline = {
      generatedAt: "2026-09-08T00:00:00.000Z",
      issues: ["default:exports:src/existing.ts:oldExport"],
      version: 1,
    };
    const comparison = compareKnipBaseline({
      baseline,
      currentIssues: [
        "default:exports:src/existing.ts:oldExport",
        "production:files:src/new.ts:src/new.ts",
      ],
    });

    assert.isFalse(comparison.ok);
    assert.equal(comparison.currentCount, 2);
    assert.deepEqual(comparison.newIssues, ["production:files:src/new.ts:src/new.ts"]);
  });
});
