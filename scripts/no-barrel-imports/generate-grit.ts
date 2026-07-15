#!/usr/bin/env bun
/**
 * Generates per-package Biome plugins from internal barrel index files.
 *
 * Policy: docs/explanation/no-barrel-imports.md
 */
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";

import {PACKAGE_SCAN_ROOTS, REPO_ROOT, renderAllNoBarrelImportsGritPlugins} from "./lib";

const OUTPUT_DIR = join(REPO_ROOT, "biome/plugins/no-barrel-imports");

const readGeneratedPlugins = (): Map<string, string> => {
  const plugins = new Map<string, string>();
  if (!existsSync(OUTPUT_DIR)) {
    return plugins;
  }

  for (const fileName of readdirSync(OUTPUT_DIR)) {
    if (!fileName.endsWith(".grit")) {
      continue;
    }
    const packageName = fileName.replace(/\.grit$/, "");
    plugins.set(packageName, readFileSync(join(OUTPUT_DIR, fileName), "utf8"));
  }

  return plugins;
};

const writeGeneratedPlugins = (plugins: Map<string, string>): void => {
  const expectedPackages = new Set(Object.keys(PACKAGE_SCAN_ROOTS));

  for (const packageName of expectedPackages) {
    const rendered = plugins.get(packageName);
    if (!rendered) {
      continue;
    }
    writeFileSync(join(OUTPUT_DIR, `${packageName}.grit`), rendered);
  }

  if (existsSync(OUTPUT_DIR)) {
    for (const fileName of readdirSync(OUTPUT_DIR)) {
      if (!fileName.endsWith(".grit")) {
        continue;
      }
      const packageName = fileName.replace(/\.grit$/, "");
      if (!expectedPackages.has(packageName) || !plugins.has(packageName)) {
        rmSync(join(OUTPUT_DIR, fileName));
      }
    }
  }
};

const main = (): void => {
  const checkOnly = process.argv.includes("--check");
  const rendered = renderAllNoBarrelImportsGritPlugins();
  const renderedWithSpecifiers = new Map(
    [...rendered.entries()].filter(([, content]) => content.includes("register_diagnostic("))
  );

  if (checkOnly) {
    const existing = readGeneratedPlugins();
    const existingKeys = [...existing.keys()].sort();
    const renderedKeys = [...renderedWithSpecifiers.keys()].sort();

    if (existingKeys.join(",") !== renderedKeys.join(",")) {
      console.error(
        "no-barrel-imports grit plugins are out of date. Run: bun run generate:no-barrel-imports-grit"
      );
      process.exit(1);
    }

    for (const [packageName, content] of renderedWithSpecifiers) {
      if (existing.get(packageName) !== content) {
        console.error(
          `no-barrel-imports/${packageName}.grit is out of date. Run: bun run generate:no-barrel-imports-grit`
        );
        process.exit(1);
      }
    }

    console.info("no-barrel-imports grit plugins: up to date");
    return;
  }

  mkdirSync(OUTPUT_DIR, {recursive: true});
  writeFileSync(join(OUTPUT_DIR, ".gitkeep"), "");
  writeGeneratedPlugins(renderedWithSpecifiers);
  console.info(`Wrote ${renderedWithSpecifiers.size} plugin(s) to ${resolve(OUTPUT_DIR)}`);
};

main();
