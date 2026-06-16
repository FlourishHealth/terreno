import {spawnSync} from "node:child_process";
import {existsSync, mkdirSync, rmSync, writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(WEBSITE_ROOT, "..");
const OUTPUT_ROOT = join(REPO_ROOT, "docs/reference/generated");

// Resolve the workspace-installed typedoc binary explicitly rather than relying on `bunx`,
// which can resolve a fresh dependency tree (and an older TypeScript peer) that rejects the
// `ignoreDeprecations: "6.0"` set in the package tsconfigs. Running the installed typedoc
// guarantees it uses the single workspace TypeScript (6.x). typedoc's `exports` map blocks
// resolving the bin subpath directly, so derive it from the resolvable package.json.
const require = createRequire(import.meta.url);
const TYPEDOC_BIN = join(dirname(require.resolve("typedoc/package.json")), "bin/typedoc");

interface PackageTarget {
  id: string;
  title: string;
  packageDir: string;
  entryFile: string;
}

const PACKAGE_TARGETS: PackageTarget[] = [
  {entryFile: "src/index.ts", id: "api", packageDir: "api", title: "@terreno/api"},
  {entryFile: "src/index.ts", id: "rtk", packageDir: "rtk", title: "@terreno/rtk"},
];

const runTypedoc = (target: PackageTarget): void => {
  const outDir = join(OUTPUT_ROOT, target.id);
  if (existsSync(outDir)) {
    rmSync(outDir, {force: true, recursive: true});
  }
  mkdirSync(outDir, {recursive: true});

  const entryPath = join(REPO_ROOT, target.packageDir, target.entryFile);
  const tsconfigPath = join(REPO_ROOT, target.packageDir, "tsconfig.json");

  const result = spawnSync(
    "bun",
    [
      TYPEDOC_BIN,
      entryPath,
      "--tsconfig",
      tsconfigPath,
      "--plugin",
      "typedoc-plugin-markdown",
      "--out",
      outDir,
      "--readme",
      "none",
      "--disableSources",
      "--excludePrivate",
      "--excludeInternal",
      "--excludeExternals",
      "--hidePageHeader",
      "--hideBreadcrumbs",
      "--hidePageTitle",
    ],
    {cwd: WEBSITE_ROOT, env: process.env, stdio: "inherit"}
  );

  if (result.status !== 0) {
    console.error(`typedoc failed for ${target.title}`);
    process.exit(result.status ?? 1);
  }
};

const writeIndex = (): void => {
  mkdirSync(OUTPUT_ROOT, {recursive: true});
  const body = PACKAGE_TARGETS.map(
    (target) =>
      `## ${target.title}

Generated API reference lives in [\`generated/${target.id}/\`](./generated/${target.id}/README.md).
`
  ).join("\n");

  writeFileSync(
    join(OUTPUT_ROOT, "README.md"),
    `---
title: Generated API reference
description: TypeDoc-generated package API references for Terreno packages.
---

# Generated API reference

These pages are generated at docs site build time via TypeDoc. Hand-written overviews remain in the sibling reference docs.

${body}
`
  );
};

const main = (): void => {
  for (const target of PACKAGE_TARGETS) {
    runTypedoc(target);
  }
  writeIndex();
  console.info(`Generated API reference for ${PACKAGE_TARGETS.length} packages in ${OUTPUT_ROOT}`);
};

main();
