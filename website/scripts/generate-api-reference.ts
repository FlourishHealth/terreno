import {spawnSync} from "node:child_process";
import {existsSync, mkdirSync, rmSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(WEBSITE_ROOT, "..");
const OUTPUT_ROOT = join(REPO_ROOT, "docs/reference/generated");

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
  const typedocTsconfigPath = join(REPO_ROOT, target.packageDir, "tsconfig.typedoc.json");
  const defaultTsconfigPath = join(REPO_ROOT, target.packageDir, "tsconfig.json");
  const tsconfigPath = existsSync(typedocTsconfigPath) ? typedocTsconfigPath : defaultTsconfigPath;
  const packageDir = join(REPO_ROOT, target.packageDir);

  const compileDependenciesResult = spawnSync(
    "node",
    [join(REPO_ROOT, ".github/scripts/compile-workspace-deps.js")],
    {cwd: packageDir, env: process.env, stdio: "inherit"}
  );
  if (compileDependenciesResult.status !== 0) {
    console.error(`Workspace dependency compilation failed for ${target.title}`);
    process.exit(compileDependenciesResult.status ?? 1);
  }

  const result = spawnSync(
    "bunx",
    [
      "typedoc",
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
