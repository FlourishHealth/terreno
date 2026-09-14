#!/usr/bin/env bun
import {join} from "node:path";

import {fingerprintKnipReport, type KnipReport} from "./lib";

const REPO_ROOT = join(import.meta.dir, "../..");
const DEPENDENCY_BASELINE_PATH = join(REPO_ROOT, ".dependency-cruiser-known-violations.json");
const DEPENDENCY_INPUTS = [
  "admin-backend/src",
  "admin-frontend/src",
  "admin-spa",
  "ai/src",
  "announcements/src",
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
      "node",
      "node_modules/knip/bin/knip.js",
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

const writeDependencyBaseline = (): void => {
  const dependencyExitCode = runDependencyCruiser({writeBaseline: true});
  if (dependencyExitCode !== 0) {
    process.exit(dependencyExitCode);
  }
  console.info("Dependency-cruiser baseline written.");
};

const checkKnip = (): boolean => {
  const issues = collectKnipIssues();
  if (issues.length === 0) {
    console.info("Knip: no findings.");
  } else {
    console.error(`Knip: ${issues.length} finding(s):`);
    for (const issue of issues.slice(0, 50)) {
      console.error(`  ${issue}`);
    }
  }
  return issues.length === 0;
};

const checkAnalysis = (): void => {
  const isKnipClean = checkKnip();
  const dependencyExitCode = runDependencyCruiser({writeBaseline: false});
  if (!isKnipClean || dependencyExitCode !== 0) {
    process.exit(1);
  }
};

const main = (): void => {
  if (process.argv.includes("--write-dependency-baseline")) {
    writeDependencyBaseline();
    return;
  }
  if (process.argv.includes("--knip-only")) {
    if (!checkKnip()) {
      process.exit(1);
    }
    return;
  }
  checkAnalysis();
};

if (import.meta.main) {
  main();
}
