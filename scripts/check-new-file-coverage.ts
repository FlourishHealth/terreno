#!/usr/bin/env bun
import {execFileSync, spawn} from "node:child_process";
import {existsSync, mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, relative, resolve, sep} from "node:path";
import {Glob} from "bun";

import {
  type CoverageSummary,
  type FileCoverage,
  evaluateCoverage,
  parseLcov,
  summarizeLcov,
} from "./check-coverage";

const DEFAULT_THRESHOLD = 90;
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx)$/;
const EXCLUDED_SOURCE_PATTERN =
  /(?:^|\/)(?:dist|coverage|node_modules|isolated|tests)(?:\/|$)|(?:^|\/)types\/.+\.ts$|(?:^|\/)story-config\/.+\.config\.tsx$|\.(?:test|spec|stories)\.(?:ts|tsx)$|openApiSdk\.ts$/;
/**
 * Expo Router route files under `app/`: `index`, `_layout`, `+not-found`, dynamic
 * segments such as `[id]`, and named recovery routes (`forgotPassword`, `resetPassword`,
 * `verifyEmail`). Those recovery screens are Playwright e2e; submit logic lives in
 * `lib/authRecoveryActions.ts`. Ordinary modules under `app/` stay gated.
 */
const EXPO_ROUTER_ENTRY_PATTERN =
  /(?:^|\/)app\/(?:.*\/)?(?:index|_layout|\+[^/]+|\[[^/]+\]|forgotPassword|resetPassword|verifyEmail)\.tsx$/;

export interface NewFileCoverageFailure {
  path: string;
  summary: CoverageSummary | null;
}

interface ParsedArgs {
  base: string;
  threshold: number;
}

interface PackageCoverage {
  packageName: string;
  files: string[];
}

export const parseNewFileCoverageArgs = (argv: readonly string[]): ParsedArgs => {
  let base = "";
  let threshold = DEFAULT_THRESHOLD;
  for (const arg of argv) {
    const baseMatch = arg.match(/^--base=(.+)$/);
    if (baseMatch) {
      base = baseMatch[1];
    }
    const thresholdMatch = arg.match(/^--threshold=(\d+(?:\.\d+)?)$/);
    if (thresholdMatch) {
      threshold = Number(thresholdMatch[1]);
    }
  }
  return {base, threshold};
};

export const isCoverageSourceFile = (path: string): boolean => {
  return (
    SOURCE_FILE_PATTERN.test(path) &&
    !EXCLUDED_SOURCE_PATTERN.test(path) &&
    !EXPO_ROUTER_ENTRY_PATTERN.test(path)
  );
};

const normalizePath = (path: string): string => path.split(sep).join("/");

const findFileCoverage = (
  coverage: Map<string, FileCoverage>,
  packageRoot: string,
  repoRelativePath: string
): FileCoverage | null => {
  const packageRelativePath = normalizePath(relative(packageRoot, resolve(repoRelativePath)));
  for (const [coveredPath, fileCoverage] of coverage.entries()) {
    const normalizedCoveredPath = normalizePath(coveredPath);
    if (
      normalizedCoveredPath === packageRelativePath ||
      normalizedCoveredPath.endsWith(`/${packageRelativePath}`)
    ) {
      return fileCoverage;
    }
  }
  return null;
};

export const evaluateNewFileCoverage = ({
  coverage,
  files,
  packageRoot,
  repoRoot,
  threshold,
}: {
  coverage: Map<string, FileCoverage>;
  files: readonly string[];
  packageRoot: string;
  repoRoot: string;
  threshold: number;
}): NewFileCoverageFailure[] => {
  const failures: NewFileCoverageFailure[] = [];
  for (const file of files) {
    const absoluteFile = resolve(repoRoot, file);
    const fileCoverage = findFileCoverage(coverage, packageRoot, absoluteFile);
    if (!fileCoverage) {
      failures.push({path: file, summary: null});
      continue;
    }
    const summary = summarizeLcov(new Map([[file, fileCoverage]]));
    if (evaluateCoverage(summary, threshold).length > 0) {
      failures.push({path: file, summary});
    }
  }
  return failures;
};

const getWorkspaceNames = (repoRoot: string): Set<string> => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    workspaces?: string[];
  };
  return new Set(packageJson.workspaces ?? []);
};

const getAddedSourceFiles = (repoRoot: string, base: string): string[] => {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=A", `${base}...HEAD`],
    {cwd: repoRoot, encoding: "utf8"}
  );
  return output
    .split("\n")
    .map((path) => path.trim())
    .filter((path) => path.length > 0 && isCoverageSourceFile(path));
};

export const groupFilesByWorkspace = ({
  files,
  workspaces,
}: {
  files: readonly string[];
  workspaces: ReadonlySet<string>;
}): PackageCoverage[] => {
  const grouped = new Map<string, string[]>();
  for (const file of files) {
    const packageName = file.split("/")[0];
    if (!workspaces.has(packageName)) {
      continue;
    }
    const packageFiles = grouped.get(packageName) ?? [];
    packageFiles.push(file);
    grouped.set(packageName, packageFiles);
  }
  return [...grouped.entries()]
    .map(([packageName, packageFiles]) => ({files: packageFiles.sort(), packageName}))
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
};

export const expandCoverageFileArgs = (args: readonly string[], cwd: string): string[] => {
  const expanded: string[] = [];
  for (const arg of args) {
    if (arg.startsWith("-") || !arg.includes("*")) {
      expanded.push(arg);
      continue;
    }
    const pattern = arg.startsWith("./") ? arg.slice(2) : arg;
    const matches = [...new Glob(pattern).scanSync({cwd, onlyFiles: true})].sort();
    expanded.push(...matches.map((path) => `./${path}`));
  }
  return expanded;
};

export const bunTestFileArgs = (testScript: string | undefined): string[] => {
  if (!testScript) {
    return [];
  }
  const firstCommand = testScript.split("&&")[0]?.trim() ?? "";
  const match = firstCommand.match(/^bun(?:x)?\s+test(?:\s+(.*))?$/);
  if (!match?.[1]) {
    return [];
  }
  return match[1].split(/\s+/).filter((token) => token.length > 0 && !token.startsWith("-"));
};

export const coverageRunArgs = ({
  hasSrcDir,
  packageName,
  testScript,
}: {
  hasSrcDir: boolean;
  packageName: string;
  testScript?: string;
}): string[] => {
  const args: string[] = [];
  if (packageName === "mcp-server") {
    args.push("--max-concurrency=1");
  }
  const fileArgs = bunTestFileArgs(testScript);
  if (fileArgs.length > 0) {
    args.push(...fileArgs);
  } else if (hasSrcDir) {
    args.push("src");
  } else {
    args.push("./**/*.test.ts", "./**/*.test.tsx");
  }
  return args;
};

/**
 * Package `test` scripts rely on the shell to expand globs such as `./**\/*.test.ts`.
 * Coverage runs spawn `bun` directly, so expand the patterns here; an unexpanded pattern
 * reaches bun as a literal filter, matches nothing, and exits non-zero.
 */
export const expandCoverageRunArgs = ({
  args,
  packageRoot,
}: {
  args: readonly string[];
  packageRoot: string;
}): string[] => {
  return args.flatMap((arg) => {
    if (!arg.includes("*")) {
      return [arg];
    }
    const matches = [
      ...new Bun.Glob(arg.replace(/^\.\//, "")).scanSync({
        cwd: packageRoot,
        onlyFiles: true,
      }),
    ]
      .filter((match) => !normalizePath(match).split("/").includes("node_modules"))
      .sort();
    return matches;
  });
};

const readPackageTestScript = (packageRoot: string): string | undefined => {
  const packageJsonPath = join(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: {test?: string};
  };
  return packageJson.scripts?.test;
};

const runPackageCoverage = async ({
  coverageDir,
  packageName,
  packageRoot,
}: {
  coverageDir: string;
  packageName: string;
  packageRoot: string;
}): Promise<number> => {
  const coverageArgs = expandCoverageRunArgs({
    args: coverageRunArgs({
      hasSrcDir: existsSync(join(packageRoot, "src")),
      packageName,
      testScript: readPackageTestScript(packageRoot),
    }),
    packageRoot,
  });
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "bun",
      [
        "test",
        ...coverageArgs,
        "--coverage",
        "--coverage-reporter=lcov",
        `--coverage-dir=${coverageDir}`,
      ],
      {
        cwd: packageRoot,
        env: {...process.env, CI: "true"},
        stdio: "inherit",
      }
    );
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise(code ?? 1);
    });
  });
};

const main = async (): Promise<void> => {
  const {base, threshold} = parseNewFileCoverageArgs(process.argv.slice(2));
  if (!base) {
    console.error("Missing required --base=<git-sha> argument.");
    process.exit(1);
  }

  const repoRoot = resolve(import.meta.dir, "..");
  const files = getAddedSourceFiles(repoRoot, base);
  const packages = groupFilesByWorkspace({
    files,
    workspaces: getWorkspaceNames(repoRoot),
  });
  if (packages.length === 0) {
    console.info("No new workspace source files require coverage.");
    return;
  }

  const allFailures: NewFileCoverageFailure[] = [];
  for (const packageCoverage of packages) {
    const packageRoot = join(repoRoot, packageCoverage.packageName);
    const coverageDir = mkdtempSync(join(tmpdir(), `terreno-${packageCoverage.packageName}-`));
    try {
      console.info(
        `\nChecking ${packageCoverage.files.length} new source file(s) in ${packageCoverage.packageName}...`
      );
      const exitCode = await runPackageCoverage({
        coverageDir,
        packageName: packageCoverage.packageName,
        packageRoot,
      });
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
      const lcovPath = join(coverageDir, "lcov.info");
      const coverage = existsSync(lcovPath)
        ? parseLcov(readFileSync(lcovPath, "utf8"))
        : new Map<string, FileCoverage>();
      allFailures.push(
        ...evaluateNewFileCoverage({
          coverage,
          files: packageCoverage.files,
          packageRoot,
          repoRoot,
          threshold,
        })
      );
    } finally {
      rmSync(coverageDir, {force: true, recursive: true});
    }
  }

  if (allFailures.length === 0) {
    console.info(`\nEvery new source file meets the ${threshold}% coverage threshold.`);
    return;
  }

  console.error(`\nNew source files below ${threshold}% coverage:`);
  for (const failure of allFailures) {
    if (!failure.summary) {
      console.error(`- ${failure.path}: absent from LCOV (0% coverage)`);
      continue;
    }
    console.error(
      `- ${failure.path}: functions=${failure.summary.functions.toFixed(2)}%, ` +
        `lines=${failure.summary.lines.toFixed(2)}%`
    );
  }
  process.exit(1);
};

if (import.meta.main) {
  void main();
}
