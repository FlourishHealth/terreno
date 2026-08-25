import {readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {DateTime} from "luxon";

import type {AnyAuditSummary, RemediationStatus} from "./lib";
import {REPO_ROOT} from "./lib";

export const BASELINE_PATH = join(REPO_ROOT, "scripts/check-explicit-any/baseline.json");

export interface ExplicitAnyBaseline {
  byFile: Record<string, number>;
  byPackage: Record<string, number>;
  byRemediationStatus: Record<RemediationStatus, number>;
  fileBlanketFiles: number;
  generatedAt: string;
  ratchet: {
    undocumented: number;
    violations: number;
    totalUsages: number;
  };
  totalFiles: number;
  totalUsages: number;
  version: 2;
}

export interface BaselineRegression {
  baseline: number;
  current: number;
  metric: string;
}

export interface BaselineComparison {
  ok: boolean;
  regressions: BaselineRegression[];
}

const countUndocumented = (summary: AnyAuditSummary): number => {
  return (
    summary.byRemediationStatus["suppressed-only"] +
    summary.byRemediationStatus["file-blanket"]
  );
};

const countByFile = (summary: AnyAuditSummary): Record<string, number> => {
  const byFile: Record<string, number> = {};
  for (const usage of summary.usages) {
    byFile[usage.file] = (byFile[usage.file] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(byFile).sort(([left], [right]) => left.localeCompare(right))
  );
};

export const summaryToBaseline = (summary: AnyAuditSummary): ExplicitAnyBaseline => {
  return {
    byFile: countByFile(summary),
    byPackage: summary.byPackage,
    byRemediationStatus: summary.byRemediationStatus,
    fileBlanketFiles: summary.fileBlanketFiles,
    generatedAt: DateTime.utc().toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    ratchet: {
      undocumented: countUndocumented(summary),
      violations: summary.byRemediationStatus.violation,
      totalUsages: summary.totalUsages,
    },
    totalFiles: summary.totalFiles,
    totalUsages: summary.totalUsages,
    version: 2,
  };
};

export const writeBaseline = (
  summary: AnyAuditSummary,
  baselinePath: string = BASELINE_PATH
): ExplicitAnyBaseline => {
  const baseline = summaryToBaseline(summary);
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return baseline;
};

export const loadBaseline = (baselinePath: string = BASELINE_PATH): ExplicitAnyBaseline => {
  const raw = readFileSync(baselinePath, "utf8");
  const parsed = JSON.parse(raw) as ExplicitAnyBaseline;
  if (parsed.version !== 2) {
    throw new Error(`Unsupported explicit-any baseline version: ${String(parsed.version)}`);
  }
  return parsed;
};

export const compareBaseline = (
  summary: AnyAuditSummary,
  baseline: ExplicitAnyBaseline
): BaselineComparison => {
  const currentUndocumented = countUndocumented(summary);
  const regressions: BaselineRegression[] = [];

  const metrics: Array<{baseline: number; current: number; metric: string}> = [
    {
      baseline: baseline.ratchet.violations,
      current: summary.byRemediationStatus.violation,
      metric: "violations",
    },
    {
      baseline: baseline.ratchet.undocumented,
      current: currentUndocumented,
      metric: "undocumented",
    },
    {
      baseline: baseline.ratchet.totalUsages,
      current: summary.totalUsages,
      metric: "totalUsages",
    },
  ];

  const currentByFile = countByFile(summary);
  for (const [file, current] of Object.entries(currentByFile)) {
    metrics.push({
      baseline: baseline.byFile[file] ?? 0,
      current,
      metric: `file:${file}`,
    });
  }

  for (const entry of metrics) {
    if (entry.current > entry.baseline) {
      regressions.push(entry);
    }
  }

  return {
    ok: regressions.length === 0,
    regressions,
  };
};

export const formatBaselineRegressionText = (comparison: BaselineComparison): string => {
  if (comparison.ok) {
    return "check-explicit-any baseline: OK (no regressions)";
  }

  const lines = comparison.regressions.map(
    (regression) =>
      `  ${regression.metric}: ${regression.current} (baseline ${regression.baseline}, +${regression.current - regression.baseline})`
  );

  return ["check-explicit-any baseline: regressions detected", ...lines].join("\n");
};
