#!/usr/bin/env bun
/**
 * Enforces the no-barrel-imports policy via the Biome GritQL plugin.
 *
 * 1. Verifies biome/plugins/no-barrel-imports.grit is up to date
 * 2. Scans for barrel imports the plugin specifiers may have missed
 *
 * Day-to-day enforcement happens through Biome lint in each package
 * (see biome.jsonc → plugins).
 *
 * Policy: docs/explanation/no-barrel-imports.md
 */
import {spawnSync} from "node:child_process";

import {REPO_ROOT, SCAN_ROOTS, collectBarrelImportViolations} from "./lib";

const runGenerateCheck = (): void => {
  const result = spawnSync("bun", ["run", "scripts/no-barrel-imports/generate-grit.ts", "--check"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const main = (): void => {
  runGenerateCheck();

  const violations = collectBarrelImportViolations(REPO_ROOT, SCAN_ROOTS);
  if (violations.length > 0) {
    console.error(`check-no-barrel-imports: found ${violations.length} barrel import(s):\n`);
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.line}  "${violation.importPath}" → ${violation.resolvedBarrel}`
      );
    }
    console.error(
      "\nImport the concrete module file instead. Regenerate the plugin with: bun run generate:no-barrel-imports-grit"
    );
    process.exit(1);
  }

  console.info("check-no-barrel-imports: OK (per-package Biome plugins are up to date)");
};

main();
