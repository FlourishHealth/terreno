#!/usr/bin/env bun
/**
 * Adds missing `// noExplicitAny:` rationale comments above biome-ignore suppressions.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {relative, resolve} from "node:path";

import {REPO_ROOT, SCAN_ROOTS, walkSourceFiles} from "./lib";

const BIOME_IGNORE_PATTERN =
  /^\s*\/\/\s*biome-ignore(?:-all)?\s+lint\/suspicious\/noExplicitAny:\s*(.+?)\s*$/;
const NO_EXPLICIT_ANY_PATTERN = /^\s*\/\/\s*noExplicitAny:\s*/;

const normalizeReason = (reason: string): string => {
  const trimmed = reason.trim();
  if (trimmed.startsWith("noExplicitAny:")) {
    return trimmed.slice("noExplicitAny:".length).trim();
  }
  return trimmed;
};

const lineHasNoExplicitAny = (lines: string[], index: number): boolean => {
  for (let offset = 1; offset <= 3; offset++) {
    const candidate = lines[index - offset];
    if (candidate !== undefined && NO_EXPLICIT_ANY_PATTERN.test(candidate)) {
      return true;
    }
  }
  return false;
};

export const remediateFileContents = (contents: string): {changed: boolean; contents: string} => {
  const lines = contents.split("\n");
  const output: string[] = [];
  let changed = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const match = line.match(BIOME_IGNORE_PATTERN);
    if (match && !lineHasNoExplicitAny(lines, index)) {
      const reason = normalizeReason(match[1] ?? "framework boundary");
      const indent = line.match(/^\s*/)?.[0] ?? "";
      output.push(`${indent}// noExplicitAny: ${reason}`);
      changed = true;
    }
    output.push(line);
  }

  return {
    changed,
    contents: output.join("\n"),
  };
};

const main = (): void => {
  const files: string[] = [];
  for (const scanRoot of SCAN_ROOTS) {
    walkSourceFiles(resolve(REPO_ROOT, scanRoot), files);
  }

  let changedFiles = 0;
  for (const absolutePath of files.sort()) {
    const original = readFileSync(absolutePath, "utf8");
    const remediated = remediateFileContents(original);
    if (!remediated.changed) {
      continue;
    }
    writeFileSync(absolutePath, remediated.contents, "utf8");
    changedFiles += 1;
    console.info(`remediated ${relative(REPO_ROOT, absolutePath)}`);
  }

  console.info(`remediate-explicit-any: updated ${changedFiles} file(s)`);
};

if (import.meta.main) {
  main();
}
