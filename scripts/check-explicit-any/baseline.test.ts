import {expect, test} from "bun:test";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  compareBaseline,
  formatBaselineRegressionText,
  summaryToBaseline,
  writeBaseline,
} from "./baseline";
import type {AnyAuditSummary} from "./lib";

const createSummary = (overrides: Partial<AnyAuditSummary> = {}): AnyAuditSummary => ({
  byPackage: {api: 10},
  byRemediationStatus: {
    "fully-documented": 2,
    "file-blanket": 5,
    "out-of-scope": 0,
    "suppressed-only": 3,
    violation: 0,
  },
  fileBlanketFiles: 1,
  totalFiles: 4,
  totalUsages: 10,
  usages: [],
  ...overrides,
});

test("summaryToBaseline captures ratchet metrics", () => {
  const baseline = summaryToBaseline(createSummary());

  expect(baseline.version).toBe(2);
  expect(baseline.ratchet.totalUsages).toBe(10);
  expect(baseline.ratchet.undocumented).toBe(8);
  expect(baseline.ratchet.violations).toBe(0);
});

test("compareBaseline fails when a new file adds explicit any without increasing the total", () => {
  const existingUsage = {
    column: 1,
    file: "api/src/existing.ts",
    hasBiomeIgnore: true,
    hasNoExplicitAnyComment: true,
    isExcludedFromBiome: false,
    isTestFile: false,
    kind: "annotation" as const,
    line: 1,
    packageName: "api",
    remediationStatus: "fully-documented" as const,
    snippet: "value: any",
    suppressionScope: "line" as const,
  };
  const baseline = summaryToBaseline(
    createSummary({
      totalUsages: 1,
      usages: [existingUsage],
    })
  );
  const shifted = createSummary({
    totalUsages: 1,
    usages: [{...existingUsage, file: "api/src/newFile.ts"}],
  });

  const comparison = compareBaseline(shifted, baseline);

  expect(comparison.ok).toBe(false);
  expect(comparison.regressions).toContainEqual({
    baseline: 0,
    current: 1,
    metric: "file:api/src/newFile.ts",
  });
});

test("compareBaseline passes when counts are unchanged or lower", () => {
  const baseline = summaryToBaseline(createSummary());
  const improved = createSummary({
    byRemediationStatus: {
      "fully-documented": 4,
      "file-blanket": 4,
      "out-of-scope": 0,
      "suppressed-only": 2,
      violation: 0,
    },
    totalUsages: 10,
  });

  expect(compareBaseline(improved, baseline).ok).toBe(true);
});

test("compareBaseline fails when counts increase", () => {
  const baseline = summaryToBaseline(createSummary());
  const regressed = createSummary({
    byRemediationStatus: {
      "fully-documented": 2,
      "file-blanket": 5,
      "out-of-scope": 0,
      "suppressed-only": 4,
      violation: 0,
    },
    totalUsages: 11,
  });

  const comparison = compareBaseline(regressed, baseline);
  expect(comparison.ok).toBe(false);
  expect(comparison.regressions.map((entry) => entry.metric)).toEqual([
    "undocumented",
    "totalUsages",
  ]);
  expect(formatBaselineRegressionText(comparison)).toContain("regressions detected");
});

test("writeBaseline persists JSON to disk", () => {
  const root = mkdtempSync(join(tmpdir(), "terreno-any-baseline-"));
  const baselinePath = join(root, "baseline.json");

  try {
    const written = writeBaseline(createSummary(), baselinePath);
    expect(written.totalUsages).toBe(10);
    expect(compareBaseline(createSummary(), written).ok).toBe(true);
  } finally {
    rmSync(root, {force: true, recursive: true});
  }
});
