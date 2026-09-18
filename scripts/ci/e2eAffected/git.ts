/** Thin git helpers for the e2e affected gate (no dependencies, CI-safe). */
import {execFileSync} from "node:child_process";

const run = ({args, repoRoot}: {args: string[]; repoRoot: string}): string =>
  execFileSync("git", args, {cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024});

export const resolveMergeBase = ({
  baseRef,
  repoRoot,
}: {
  baseRef: string;
  repoRoot: string;
}): string | undefined => {
  try {
    return run({args: ["merge-base", baseRef, "HEAD"], repoRoot}).trim() || undefined;
  } catch {
    return undefined;
  }
};

export const changedFilesSince = ({
  baseSha,
  repoRoot,
}: {
  baseSha: string;
  repoRoot: string;
}): string[] | undefined => {
  try {
    return run({args: ["diff", "--name-only", baseSha, "HEAD"], repoRoot})
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return undefined;
  }
};

export const readFileAtRef = ({
  path,
  ref,
  repoRoot,
}: {
  path: string;
  ref: string;
  repoRoot: string;
}): string | undefined => {
  try {
    return run({args: ["show", `${ref}:${path}`], repoRoot});
  } catch {
    return undefined;
  }
};
