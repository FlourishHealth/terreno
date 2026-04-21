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

interface ParsedArgs {
  threshold: number;
}

const parseArgs = (): ParsedArgs => {
  let threshold = 95;
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--threshold=(\d+(?:\.\d+)?)$/);
    if (match) {
      threshold = Number(match[1]);
    }
  }
  return {threshold};
};

const stripAnsi = (value: string): string =>
  // eslint-disable-next-line no-control-regex
  value.replace(/\u001b\[[0-9;]*m/g, "");

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

const parseAllFilesRow = (output: string): {functions: number; lines: number} | null => {
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

const main = async (): Promise<void> => {
  const {threshold} = parseArgs();
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

  const {functions, lines} = summary;
  console.info(
    `\nCoverage summary: functions=${functions.toFixed(2)}%, lines=${lines.toFixed(2)}% ` +
      `(threshold=${threshold}%)`
  );

  const failures: string[] = [];
  if (functions < threshold) {
    failures.push(`functions ${functions.toFixed(2)}% < ${threshold}%`);
  }
  if (lines < threshold) {
    failures.push(`lines ${lines.toFixed(2)}% < ${threshold}%`);
  }

  if (failures.length > 0) {
    console.error(`\nCoverage below threshold: ${failures.join(", ")}`);
    process.exit(1);
  }

  console.info("Coverage meets the minimum threshold.");
};

void main();
