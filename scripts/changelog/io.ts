import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {
  isFragmentFileName,
  parseChangelogFragment,
  type ChangelogFragment,
  type ChangelogValidationFailure,
} from "./lib";

export const UNRELEASED_DIR_NAME = "changelog/unreleased";

export const listUnreleasedDirectoryFileNames = (repoRoot: string): string[] => {
  const directoryPath = join(repoRoot, UNRELEASED_DIR_NAME);
  return readdirSync(directoryPath, {withFileTypes: true})
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
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

  for (const fileName of listUnreleasedDirectoryFileNames(repoRoot)) {
    if (!isFragmentFileName(fileName)) {
      if (fileName.toLowerCase() === "readme.md") {
        continue;
      }

      failures.push({
        fileName,
        message:
          "file name must be kebab-case.md (for example sendgrid-mail-provider.md); README.md is reserved",
      });
      continue;
    }

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
