#!/usr/bin/env bun
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {checkLicenseCoverage, PUBLISHED_PACKAGES} from "./lib";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const main = (): void => {
  const failures = checkLicenseCoverage({
    repoRoot: REPO_ROOT,
    publishedPackages: PUBLISHED_PACKAGES,
  });

  if (failures.length === 0) {
    console.info(`check-licenses: OK (${PUBLISHED_PACKAGES.length} published packages)`);
    return;
  }

  console.error(`check-licenses: found ${failures.length} problem(s):\n`);
  for (const failure of failures) {
    console.error(`  ${failure.packageDir}: ${failure.message}`);
  }

  process.exit(1);
};

main();
