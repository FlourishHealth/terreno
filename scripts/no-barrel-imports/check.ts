#!/usr/bin/env bun
/**
 * Enforces the no-barrel-imports policy.
 *
 * 1. Fails if any internal barrel index file exists (also enforced at lint
 *    time by the `noBarrelFile` override in the root biome.jsonc)
 * 2. Fails if any import resolves through a barrel index file (safety net
 *    for cases lint cannot see, e.g. path-alias imports across configs)
 *
 * Day-to-day enforcement happens through Biome lint:
 * - `noBarrelFile` override bans internal barrel index files
 * - biome/plugins/no-barrel-imports.grit bans path-alias directory imports
 *
 * Policy: docs/explanation/no-barrel-imports.md
 */
import {
  collectBarrelImportViolations,
  collectInternalBarrelIndexFiles,
  REPO_ROOT,
  SCAN_ROOTS,
} from "./lib";

const main = (): void => {
  const barrelFiles = collectInternalBarrelIndexFiles(REPO_ROOT, SCAN_ROOTS);
  if (barrelFiles.length > 0) {
    console.error(
      `check-no-barrel-imports: found ${barrelFiles.length} internal barrel index file(s):\n`
    );
    for (const file of barrelFiles) {
      console.error(`  ${file}`);
    }
    console.error(
      "\nInternal barrel index files are not allowed. Export from the package public entry or import concrete modules instead. See docs/explanation/no-barrel-imports.md"
    );
    process.exit(1);
  }

  const violations = collectBarrelImportViolations(REPO_ROOT, SCAN_ROOTS);
  if (violations.length > 0) {
    console.error(`check-no-barrel-imports: found ${violations.length} barrel import(s):\n`);
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.line}  "${violation.importPath}" → ${violation.resolvedBarrel}`
      );
    }
    console.error(
      "\nImport the concrete module file instead. See docs/explanation/no-barrel-imports.md"
    );
    process.exit(1);
  }

  console.info("check-no-barrel-imports: OK (no internal barrels, no barrel imports)");
};

main();
