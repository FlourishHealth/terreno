#!/usr/bin/env bun
/**
 * Runs `bun test --coverage` in the working directory and fails with a
 * non-zero exit code if either the function or line coverage is below the
 * threshold.
 *
 * Bun's built-in `coverageThreshold` key is parsed but does not cause a
 * non-zero exit when coverage falls below the configured threshold (verified
 * on Bun 1.3.10). See https://github.com/oven-sh/bun/issues/7367 and the
 * pending fix in https://github.com/oven-sh/bun/pull/27933. Until that lands,
 * this script acts as the CI-side gate for the 95% minimum coverage
 * requirement declared in each package's bunfig.toml.
 *
 * When the package contains tests in `src/isolated/*.isolated.{ts,tsx}`, each
 * isolated test file is run in its own `bun test` invocation (because those
 * tests rely on module-level `mock.module` calls that leak across files and
 * would otherwise pollute unrelated suites). The resulting LCOV coverage
 * reports are merged so the reported percentage reflects the union of all
 * passes.
 *
 * Usage:
 *   bun run ../scripts/check-coverage.ts [--threshold=95]
 */
import {spawn} from "node:child_process";
import {existsSync, readFileSync, readdirSync, rmSync} from "node:fs";
import {join, resolve} from "node:path";

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

export interface FileCoverage {
  /** line number -> max observed hit count across runs */
  lines: Map<number, number>;
  /**
   * Per-function hit counts, keyed by `<line>:<name>`. Only populated when the
   * LCOV producer emits `FN:`/`FNDA:` records. When present, the union of hit
   * functions across merged runs is exact; when absent (e.g. Bun 1.3.x, which
   * only writes FNF/FNH aggregates), we fall back to `functionsFound` /
   * `functionsHit`.
   */
  functions: Map<string, number>;
  /** Max "functions found" across merged runs; fallback when FN records absent. */
  functionsFound: number;
  /** Max "functions hit" across merged runs; fallback when FNDA records absent. */
  functionsHit: number;
  /** True when at least one merged run emitted FN records for this file. */
  hasFnRecords: boolean;
}

const disambiguateKey = (key: string, functions: Map<string, number>): string => {
  if (!functions.has(key)) {
    return key;
  }
  let suffix = 2;
  while (functions.has(`${key}#${suffix}`)) {
    suffix += 1;
  }
  return `${key}#${suffix}`;
};

const createFileCoverage = (): FileCoverage => ({
  functions: new Map(),
  functionsFound: 0,
  functionsHit: 0,
  hasFnRecords: false,
  lines: new Map(),
});

export const parseLcov = (text: string): Map<string, FileCoverage> => {
  const result = new Map<string, FileCoverage>();
  let current: FileCoverage | null = null;
  // FN records come before FNDA. Anonymous functions can share a name, so we
  // map the printed name -> ordered list of unique keys, and consume them in
  // order as FNDA records are encountered.
  let nameToKeys: Map<string, string[]> | null = null;
  let fndaIndex: Map<string, number> | null = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("SF:")) {
      const path = line.slice(3);
      current = result.get(path) ?? createFileCoverage();
      result.set(path, current);
      nameToKeys = new Map();
      fndaIndex = new Map();
      continue;
    }
    if (!current || !nameToKeys || !fndaIndex) {
      continue;
    }
    if (line.startsWith("DA:")) {
      const [lineNo, hits] = line.slice(3).split(",").map(Number);
      if (Number.isFinite(lineNo) && Number.isFinite(hits)) {
        const prev = current.lines.get(lineNo);
        if (prev === undefined || hits > prev) {
          current.lines.set(lineNo, hits);
        }
      }
      continue;
    }
    if (line.startsWith("FN:")) {
      // FN:<line>,<name>
      const rest = line.slice(3);
      const commaIndex = rest.indexOf(",");
      if (commaIndex < 0) {
        continue;
      }
      const lineNo = rest.slice(0, commaIndex);
      const name = rest.slice(commaIndex + 1);
      const key = disambiguateKey(`${lineNo}:${name}`, current.functions);
      current.functions.set(key, current.functions.get(key) ?? 0);
      current.hasFnRecords = true;
      const keys = nameToKeys.get(name) ?? [];
      keys.push(key);
      nameToKeys.set(name, keys);
      continue;
    }
    if (line.startsWith("FNDA:")) {
      // FNDA:<hits>,<name>
      const rest = line.slice(5);
      const commaIndex = rest.indexOf(",");
      if (commaIndex < 0) {
        continue;
      }
      const hits = Number(rest.slice(0, commaIndex));
      const name = rest.slice(commaIndex + 1);
      if (!Number.isFinite(hits)) {
        continue;
      }
      const keys = nameToKeys.get(name);
      if (!keys || keys.length === 0) {
        continue;
      }
      const idx = fndaIndex.get(name) ?? 0;
      const key = keys[Math.min(idx, keys.length - 1)];
      fndaIndex.set(name, idx + 1);
      const prev = current.functions.get(key) ?? 0;
      if (hits > prev) {
        current.functions.set(key, hits);
      }
      continue;
    }
    if (line.startsWith("FNF:")) {
      const n = Number(line.slice(4));
      if (Number.isFinite(n) && n > current.functionsFound) {
        current.functionsFound = n;
      }
      continue;
    }
    if (line.startsWith("FNH:")) {
      const n = Number(line.slice(4));
      if (Number.isFinite(n) && n > current.functionsHit) {
        current.functionsHit = n;
      }
      continue;
    }
    if (line === "end_of_record") {
      current = null;
      nameToKeys = null;
      fndaIndex = null;
    }
  }
  return result;
};

export const mergeLcov = (
  target: Map<string, FileCoverage>,
  source: Map<string, FileCoverage>
): Map<string, FileCoverage> => {
  for (const [path, src] of source.entries()) {
    const existing = target.get(path);
    if (!existing) {
      target.set(path, {
        functions: new Map(src.functions),
        functionsFound: src.functionsFound,
        functionsHit: src.functionsHit,
        hasFnRecords: src.hasFnRecords,
        lines: new Map(src.lines),
      });
      continue;
    }
    for (const [name, hits] of src.functions.entries()) {
      const prev = existing.functions.get(name) ?? 0;
      if (hits > prev) {
        existing.functions.set(name, hits);
      }
    }
    if (src.functionsFound > existing.functionsFound) {
      existing.functionsFound = src.functionsFound;
    }
    if (src.functionsHit > existing.functionsHit) {
      existing.functionsHit = src.functionsHit;
    }
    if (src.hasFnRecords) {
      existing.hasFnRecords = true;
    }
    for (const [lineNo, hits] of src.lines.entries()) {
      const prev = existing.lines.get(lineNo) ?? 0;
      if (hits > prev) {
        existing.lines.set(lineNo, hits);
      }
    }
  }
  return target;
};

export const summarizeLcov = (coverage: Map<string, FileCoverage>): CoverageSummary => {
  let totalLines = 0;
  let hitLines = 0;
  let totalFns = 0;
  let hitFns = 0;
  for (const entry of coverage.values()) {
    totalLines += entry.lines.size;
    for (const hits of entry.lines.values()) {
      if (hits > 0) {
        hitLines += 1;
      }
    }
    if (entry.hasFnRecords) {
      totalFns += entry.functions.size;
      for (const hits of entry.functions.values()) {
        if (hits > 0) {
          hitFns += 1;
        }
      }
    } else {
      totalFns += entry.functionsFound;
      hitFns += entry.functionsHit;
    }
  }
  return {
    functions: totalFns === 0 ? 100 : (hitFns / totalFns) * 100,
    lines: totalLines === 0 ? 100 : (hitLines / totalLines) * 100,
  };
};

const runBunTest = async (
  args: readonly string[]
): Promise<{exitCode: number; output: string}> => {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("bun", ["test", ...args], {
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
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise({exitCode: code ?? 1, output});
    });
  });
};

const findIsolatedFiles = (cwd: string): string[] => {
  const dir = join(cwd, "src", "isolated");
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith(".isolated.ts") || f.endsWith(".isolated.tsx"))
    .map((f) => `./${join("src", "isolated", f)}`)
    .sort();
};

const readLcov = (coverageDir: string): Map<string, FileCoverage> => {
  const lcovPath = join(coverageDir, "lcov.info");
  if (!existsSync(lcovPath)) {
    return new Map();
  }
  return parseLcov(readFileSync(lcovPath, "utf8"));
};

const main = async (): Promise<void> => {
  const {threshold} = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const isolated = findIsolatedFiles(cwd);

  if (isolated.length === 0) {
    const {exitCode, output} = await runBunTest([
      "--coverage",
      "--coverage-reporter=text",
    ]);
    if (exitCode !== 0) {
      console.error(`\nbun test exited with code ${exitCode}`);
      process.exit(exitCode);
    }
    const summary = parseAllFilesRow(output);
    if (!summary) {
      console.error('\nCould not find an "All files" row in the coverage output.');
      process.exit(1);
    }
    reportSummary(summary, threshold);
    return;
  }

  console.info(
    `\nFound ${isolated.length} isolated test file(s); running separate coverage passes.\n`
  );

  const mergedCoverage = new Map<string, FileCoverage>();
  const coverageDirs: string[] = [];

  const mainDir = resolve(cwd, "coverage-main");
  coverageDirs.push(mainDir);
  rmSync(mainDir, {force: true, recursive: true});

  const mainRun = await runBunTest([
    "--coverage",
    "--coverage-reporter=text",
    "--coverage-reporter=lcov",
    `--coverage-dir=${mainDir}`,
  ]);
  if (mainRun.exitCode !== 0) {
    console.error(`\nbun test exited with code ${mainRun.exitCode}`);
    process.exit(mainRun.exitCode);
  }
  mergeLcov(mergedCoverage, readLcov(mainDir));

  for (let index = 0; index < isolated.length; index += 1) {
    const testFile = isolated[index];
    const dir = resolve(cwd, `coverage-iso-${index}`);
    coverageDirs.push(dir);
    rmSync(dir, {force: true, recursive: true});
    console.info(`\n--- Isolated coverage pass for ${testFile} ---`);
    const run = await runBunTest([
      testFile,
      "--coverage",
      "--coverage-reporter=lcov",
      `--coverage-dir=${dir}`,
    ]);
    if (run.exitCode !== 0) {
      console.error(`\nbun test ${testFile} exited with code ${run.exitCode}`);
      process.exit(run.exitCode);
    }
    mergeLcov(mergedCoverage, readLcov(dir));
  }

  const summary = summarizeLcov(mergedCoverage);
  reportSummary(summary, threshold);

  if (!process.env.KEEP_COVERAGE) {
    for (const dir of coverageDirs) {
      rmSync(dir, {force: true, recursive: true});
    }
  }
};

const reportSummary = (summary: CoverageSummary, threshold: number): void => {
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
