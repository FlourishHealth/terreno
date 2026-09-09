#!/usr/bin/env bun
import {existsSync} from "node:fs";
import {join} from "node:path";

import {groupFilesByBiomeDirectory, parseChangedFileOutput, selectAnalyzableFiles} from "./lib";

const REPO_ROOT = join(import.meta.dir, "../..");

const runGitFileList = (args: string[]): string[] => {
  const result = Bun.spawnSync({
    cmd: ["git", ...args],
    cwd: REPO_ROOT,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `git ${args.join(" ")} failed`);
  }
  return parseChangedFileOutput(result.stdout.toString());
};

const collectFiles = ({isStaged}: {isStaged: boolean}): string[] => {
  if (isStaged) {
    return runGitFileList(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]);
  }

  return [
    ...runGitFileList(["diff", "--name-only", "--diff-filter=ACMR", "-z"]),
    ...runGitFileList(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]),
    ...runGitFileList(["ls-files", "--others", "--exclude-standard", "-z"]),
  ];
};

const runBiome = ({cwd, files}: {cwd: string; files: string[]}): number => {
  const result = Bun.spawnSync({
    cmd: ["bunx", "biome", "check", "--reporter=concise", "--no-errors-on-unmatched", ...files],
    cwd,
    stderr: "inherit",
    stdout: "inherit",
  });
  return result.exitCode;
};

const main = (): void => {
  const isStaged = process.argv.includes("--staged");
  const files = selectAnalyzableFiles(collectFiles({isStaged}), (file): boolean =>
    existsSync(join(REPO_ROOT, file))
  );
  const runs = groupFilesByBiomeDirectory({files, repoRoot: REPO_ROOT});
  if (runs.length === 0) {
    console.info("Biome: no changed analyzable files.");
    return;
  }

  for (const run of runs) {
    const exitCode = runBiome(run);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }

  const checkedFileCount = runs.reduce((count, run) => count + run.files.length, 0);
  console.info(`Biome: ${checkedFileCount} changed file(s) passed.`);
};

if (import.meta.main) {
  main();
}
