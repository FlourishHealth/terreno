#!/usr/bin/env bun
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {loadUnreleasedFragments} from "./io";
import {renderUnreleasedSection} from "./lib";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const main = (): void => {
  const {failures, fragments} = loadUnreleasedFragments(REPO_ROOT);

  if (failures.length > 0) {
    console.error(`changelog:preview: found ${failures.length} invalid fragment(s):\n`);
    for (const failure of failures) {
      console.error(`  ${failure.fileName}: ${failure.message}`);
    }
    process.exit(1);
  }

  if (fragments.length === 0) {
    console.info("changelog:preview: no unreleased fragments");
    return;
  }

  console.info(renderUnreleasedSection(fragments));
};

main();
