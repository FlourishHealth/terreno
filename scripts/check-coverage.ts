#!/usr/bin/env bun
/**
 * Runs `bun test --coverage` in the working directory, then parses the
 * "All files" row of the text coverage reporter and fails with a non-zero
 * exit code if either the function or line coverage is below the threshold.
 *
 * Bun's built-in `coverageThreshold` key is not enforced as of Bun 1.3.5,
 * so this script acts as the CI-side gate for the 95% minimum coverage
 * requirement declared in each package's bunfig.toml.
 *
 * Usage:
 *   bun run ../scripts/check-coverage.ts [--threshold=95]
 */
import {spawn} from "node:child_process";

export interface ParsedArgs {
  threshold: number;
}

export const parseArgs = (argv: readonly string[]): ParsedArgs => {
  let threshold = 95;
  for (const arg of argv) {
    const match = arg.match(/^--threshold=(\d+(?:\.\d+)?)$/);
    if (match) {
      threshold = Number(match[1]);
    }
  }
  return {threshold};
};

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

export const stripAnsi = (value: string): string => value.replace(ANSI_PATTERN, "");

export interface CoverageSummary {
  functions: number;
  lines: number;
}

export const parseAllFilesRow = (output: string): CoverageSummary | null => {
  const cleaned = stripAnsi(output);
  for (const rawLine of cleaned.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("All files")) {
      continue;
    }
    const parts = line.split("|").map((segment) => segment.trim());
    if (parts.length < 3) {
      continue;
    }
    const functions = Number(parts[1]);
    const lines = Number(parts[2]);
    if (Number.isFinite(functions) && Number.isFinite(lines)) {
      return {functions, lines};
    }
  }
  return null;
};

export interface CoverageFailure {
  metric: "functions" | "lines";
  actual: number;
  threshold: number;
}

export const evaluateCoverage = (
  summary: CoverageSummary,
  threshold: number
): CoverageFailure[] => {
  const failures: CoverageFailure[] = [];
  if (summary.functions < threshold) {
    failures.push({metric: "functions", actual: summary.functions, threshold});
  }
  if (summary.lines < threshold) {
    failures.push({metric: "lines", actual: summary.lines, threshold});
  }
  return failures;
};

const runBunTest = async (): Promise<{exitCode: number; output: string}> => {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", ["test", "--coverage", "--coverage-reporter=text"], {
      env: {...process.env, FORCE_COLOR: "0"},
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({exitCode: code ?? 1, output});
    });
  });
};

const main = async (): Promise<void> => {
  const {threshold} = parseArgs(process.argv.slice(2));
  const {exitCode, output} = await runBunTest();

  if (exitCode !== 0) {
    console.error(`\nbun test exited with code ${exitCode}`);
    process.exit(exitCode);
  }

  const summary = parseAllFilesRow(output);
  if (!summary) {
    console.error('\nCould not find an "All files" row in the coverage output.');
    process.exit(1);
  }

  console.info(
    `\nCoverage summary: functions=${summary.functions.toFixed(2)}%, ` +
      `lines=${summary.lines.toFixed(2)}% (threshold=${threshold}%)`
  );

  const failures = evaluateCoverage(summary, threshold);
  if (failures.length > 0) {
    const message = failures
      .map((f) => `${f.metric} ${f.actual.toFixed(2)}% < ${f.threshold}%`)
      .join(", ");
    console.error(`\nCoverage below threshold: ${message}`);
    process.exit(1);
  }

  console.info("Coverage meets the minimum threshold.");
};

if (import.meta.main) {
  void main();
}
