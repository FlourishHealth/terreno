#!/usr/bin/env bun
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {loadUnreleasedFragments} from "./io";
import {checkUnreleasedSection} from "./lib";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const main = (): void => {
  const changelog = readFileSync(join(REPO_ROOT, "CHANGELOG.md"), "utf8");
  const unreleasedFailure = checkUnreleasedSection(changelog);
  const {failures, fragments} = loadUnreleasedFragments(REPO_ROOT);
  const allFailures = unreleasedFailure ? [unreleasedFailure, ...failures] : failures;

  if (allFailures.length > 0) {
    console.error(`check-changelog: found ${allFailures.length} problem(s):\n`);
    for (const failure of allFailures) {
      console.error(`  ${failure.fileName}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.info(
    `check-changelog: OK — ${fragments.length} unreleased fragment(s), CHANGELOG.md Unreleased is a pointer`,
  );
};

main();
