import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {
  isFragmentFileName,
  parseChangelogFragment,
  type ChangelogFragment,
  type ChangelogValidationFailure,
} from "./lib";

export const UNRELEASED_DIR_NAME = "changelog/unreleased";

export const listUnreleasedFragmentFileNames = (repoRoot: string): string[] => {
  const directoryPath = join(repoRoot, UNRELEASED_DIR_NAME);
  return readdirSync(directoryPath)
    .filter((fileName) => isFragmentFileName(fileName))
    .sort();
};

export const loadUnreleasedFragments = (
  repoRoot: string,
): {
  failures: ChangelogValidationFailure[];
  fragments: ChangelogFragment[];
} => {
  const directoryPath = join(repoRoot, UNRELEASED_DIR_NAME);
  const fragments: ChangelogFragment[] = [];
  const failures: ChangelogValidationFailure[] = [];

  for (const fileName of listUnreleasedFragmentFileNames(repoRoot)) {
    const content = readFileSync(join(directoryPath, fileName), "utf8");
    const parsed = parseChangelogFragment({content, fileName});

    if ("message" in parsed) {
      failures.push(parsed);
      continue;
    }

    fragments.push(parsed);
  }

  return {failures, fragments};
};
