import {readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";

import type {AnyAuditSummary, RemediationStatus} from "./lib";
import {REPO_ROOT} from "./lib";

export const BASELINE_PATH = join(REPO_ROOT, "scripts/check-explicit-any/baseline.json");

export interface ExplicitAnyBaseline {
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
  version: 1;
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

export const summaryToBaseline = (summary: AnyAuditSummary): ExplicitAnyBaseline => {
  return {
    byPackage: summary.byPackage,
    byRemediationStatus: summary.byRemediationStatus,
    fileBlanketFiles: summary.fileBlanketFiles,
    generatedAt: new Date().toISOString(),
    ratchet: {
      undocumented: countUndocumented(summary),
      violations: summary.byRemediationStatus.violation,
      totalUsages: summary.totalUsages,
    },
    totalFiles: summary.totalFiles,
    totalUsages: summary.totalUsages,
    version: 1,
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
  if (parsed.version !== 1) {
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
