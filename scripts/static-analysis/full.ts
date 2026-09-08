#!/usr/bin/env bun
import {join} from "node:path";
import {DateTime} from "luxon";

import {
  compareKnipBaseline,
  fingerprintKnipReport,
  type KnipBaseline,
  type KnipReport,
} from "./lib";

const REPO_ROOT = join(import.meta.dir, "../..");
const KNIP_BASELINE_PATH = join(import.meta.dir, "knip-baseline.json");
const DEPENDENCY_BASELINE_PATH = join(REPO_ROOT, ".dependency-cruiser-known-violations.json");
const DEPENDENCY_INPUTS = [
  "admin-backend/src",
  "admin-frontend/src",
  "admin-spa",
  "ai/src",
  "api/src",
  "api-health/src",
  "comms/src",
  "demo",
  "example-backend/src",
  "example-frontend",
  "feature-flags/src",
  "mcp-server/src",
  "rtk/src",
  "scripts",
  "syncdb/src",
  "test/src",
  "ui/src",
  "website/src",
];

const runKnip = ({isProduction}: {isProduction: boolean}): KnipReport => {
  const result = Bun.spawnSync({
    cmd: [
      "bunx",
      "knip",
      "--cache",
      "--no-exit-code",
      "--reporter",
      "json",
      ...(isProduction ? ["--production"] : []),
    ],
    cwd: REPO_ROOT,
    stderr: "pipe",
    stdout: "pipe",
  });
  const stderr = result.stderr.toString().trim();
  if (result.exitCode !== 0) {
    throw new Error(stderr || "Knip failed without a diagnostic");
  }
  if (stderr) {
    console.warn(stderr);
  }
  return JSON.parse(result.stdout.toString()) as KnipReport;
};

const collectKnipIssues = (): string[] => {
  const defaultIssues = fingerprintKnipReport({
    mode: "default",
    report: runKnip({isProduction: false}),
  });
  const productionIssues = fingerprintKnipReport({
    mode: "production",
    report: runKnip({isProduction: true}),
  });
  return [...new Set([...defaultIssues, ...productionIssues])].sort();
};

const runDependencyCruiser = ({writeBaseline}: {writeBaseline: boolean}): number => {
  const baselineArgs = writeBaseline
    ? ["--output-type", "baseline", "--output-to", DEPENDENCY_BASELINE_PATH]
    : ["--ignore-known", DEPENDENCY_BASELINE_PATH];
  const result = Bun.spawnSync({
    cmd: [
      "bunx",
      "depcruise",
      "--config",
      ".dependency-cruiser.js",
      "--cache",
      ...baselineArgs,
      ...DEPENDENCY_INPUTS,
    ],
    cwd: REPO_ROOT,
    stderr: "inherit",
    stdout: "inherit",
  });
  return result.exitCode;
};

const writeBaselines = async (): Promise<void> => {
  const issues = collectKnipIssues();
  const baseline: KnipBaseline = {
    generatedAt: DateTime.utc().toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    issues,
    version: 1,
  };
  await Bun.write(KNIP_BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);

  const dependencyExitCode = runDependencyCruiser({writeBaseline: true});
  if (dependencyExitCode !== 0) {
    process.exit(dependencyExitCode);
  }
  console.info(`Static-analysis baselines written (${issues.length} Knip findings).`);
};

const checkBaselines = async (): Promise<void> => {
  const baseline = (await Bun.file(KNIP_BASELINE_PATH).json()) as KnipBaseline;
  if (baseline.version !== 1) {
    throw new Error(`Unsupported Knip baseline version: ${String(baseline.version)}`);
  }

  const comparison = compareKnipBaseline({
    baseline,
    currentIssues: collectKnipIssues(),
  });
  if (comparison.ok) {
    console.info(`Knip: no new findings (${comparison.currentCount} baseline findings remain).`);
  } else {
    console.error(`Knip: ${comparison.newIssues.length} new finding(s):`);
    for (const issue of comparison.newIssues.slice(0, 50)) {
      console.error(`  ${issue}`);
    }
  }

  const dependencyExitCode = runDependencyCruiser({writeBaseline: false});
  if (!comparison.ok || dependencyExitCode !== 0) {
    process.exit(1);
  }
};

const main = async (): Promise<void> => {
  if (process.argv.includes("--write-baseline")) {
    await writeBaselines();
    return;
  }
  await checkBaselines();
};

if (import.meta.main) {
  await main();
}
