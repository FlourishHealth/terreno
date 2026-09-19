#!/usr/bin/env bun
/**
 * Decides which Playwright e2e shards a branch needs.
 *
 * CircleCI runs this once in `e2e-prepare` and persists the result; each shard
 * halts when it is not in the affected set. The gate fails open: any problem
 * resolving the base revision, parsing a module, or classifying a file marks
 * every shard affected.
 *
 * Usage:
 *   bun run scripts/ci/e2eAffected/check.ts [--base origin/master] [--write path]
 *   bun run scripts/ci/e2eAffected/check.ts --shard auth   # exit 3 when skippable
 *
 * Policy: docs/how-to/circleci.md
 */
import {writeFileSync} from "node:fs";
import {dirname, join} from "node:path";

import {computeAffected, type ShardDecision} from "./affected";
import {changedFilesSince, readFileAtRef, resolveMergeBase} from "./git";
import {pullRequestShards} from "./shards";

const REPO_ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..");

const SKIP_EXIT_CODE = 3;

interface Options {
  base: string;
  shard?: string;
  write?: string;
}

export const parseArguments = (argv: string[]): Options => {
  const options: Options = {base: process.env.E2E_AFFECTED_BASE_REF || "origin/master"};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--base" && value) {
      options.base = value;
      index += 1;
    } else if (flag === "--write" && value) {
      options.write = value;
      index += 1;
    } else if (flag === "--shard" && value) {
      options.shard = value;
      index += 1;
    }
  }
  return options;
};

const allAffected = (reason: string): ShardDecision[] =>
  pullRequestShards().map((shard) => ({affected: true, name: shard.name, reasons: [reason]}));

const decide = ({base}: {base: string}): {decisions: ShardDecision[]; changedFiles: string[]} => {
  const mergeBase = resolveMergeBase({baseRef: base, repoRoot: REPO_ROOT});
  if (!mergeBase) {
    return {changedFiles: [], decisions: allAffected(`no merge base with ${base}`)};
  }
  const baseSources = new Map<string, string | undefined>();
  const readBaseFile = (path: string): string | undefined => {
    if (!baseSources.has(path)) {
      baseSources.set(path, readFileAtRef({path, ref: mergeBase, repoRoot: REPO_ROOT}));
    }
    return baseSources.get(path);
  };
  const changedFiles = changedFilesSince({baseSha: mergeBase, repoRoot: REPO_ROOT});
  if (!changedFiles) {
    return {changedFiles: [], decisions: allAffected(`could not diff against ${mergeBase}`)};
  }
  if (changedFiles.length === 0) {
    return {changedFiles, decisions: allAffected("no changed files resolved")};
  }
  try {
    const result = computeAffected({changedFiles, readBaseFile, repoRoot: REPO_ROOT});
    return {changedFiles: result.changedFiles, decisions: result.shards};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {changedFiles, decisions: allAffected(`affected analysis failed: ${message}`)};
  }
};

const main = (): void => {
  const options = parseArguments(process.argv.slice(2));
  const {changedFiles, decisions} = decide({base: options.base});

  const payload = {
    base: options.base,
    changedFiles,
    shards: Object.fromEntries(
      decisions.map((decision) => [
        decision.name,
        {affected: decision.affected, reasons: decision.reasons},
      ])
    ),
  };

  if (options.write) {
    writeFileSync(options.write, `${JSON.stringify(payload, null, 2)}\n`);
  }

  for (const decision of decisions) {
    const verdict = decision.affected ? "run" : "skip";
    const because = decision.reasons[0] ?? "no changed file reaches this shard";
    console.info(`e2e-affected: ${decision.name} -> ${verdict} (${because})`);
  }

  if (!options.shard) {
    return;
  }
  const selected = decisions.find((decision) => decision.name === options.shard);
  if (!selected) {
    console.info(`e2e-affected: unknown shard ${options.shard}; running it`);
    return;
  }
  if (!selected.affected) {
    process.exit(SKIP_EXIT_CODE);
  }
};

if (import.meta.main) {
  main();
}
