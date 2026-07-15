#!/usr/bin/env bun
/**
 * Generates biome/plugins/no-barrel-imports.grit from internal barrel index files.
 *
 * Policy: docs/explanation/no-barrel-imports.md
 */
import {readFileSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";

import {REPO_ROOT, renderNoBarrelImportsGritPlugin} from "./lib";

const OUTPUT_PATH = join(REPO_ROOT, "biome/plugins/no-barrel-imports.grit");

const main = (): void => {
  const checkOnly = process.argv.includes("--check");
  const rendered = renderNoBarrelImportsGritPlugin();

  if (checkOnly) {
    const existing = readFileSync(OUTPUT_PATH, "utf8");
    if (existing !== rendered) {
      console.error(
        "no-barrel-imports.grit is out of date. Run: bun run scripts/no-barrel-imports/generate-grit.ts"
      );
      process.exit(1);
    }
    console.info("no-barrel-imports.grit: up to date");
    return;
  }

  writeFileSync(OUTPUT_PATH, rendered);
  console.info(`Wrote ${resolve(OUTPUT_PATH)}`);
};

main();
