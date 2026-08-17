#!/usr/bin/env bun

import {execFile} from "node:child_process";
import {existsSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {basename, dirname, extname, join, resolve, sep} from "node:path";

// Find the CLI binary path directly
const cliPath = join(
  __dirname,
  "..",
  "..",
  "node_modules",
  "@rtk-query",
  "codegen-openapi",
  "lib",
  "bin",
  "cli.mjs"
);
const configFile = process.argv[2] ?? "openapi-config.ts";
const sdkFile = process.argv[3] ?? "store/openApiSdk.ts";
const projectRoot = resolve(__dirname, "..");
const configPath = resolve(projectRoot, configFile);
const sdkPath = resolve(projectRoot, sdkFile);
const tsConfigPath = join(__dirname, "..", "tsconfig.codegen.json");
const canonicalProjectRoot = realpathSync(projectRoot);

const isProjectFile = (filePath: string): boolean => {
  if (!filePath.startsWith(`${projectRoot}${sep}`) || extname(filePath) !== ".ts") {
    return false;
  }
  try {
    const canonicalPath = existsSync(filePath)
      ? realpathSync(filePath)
      : resolve(realpathSync(dirname(filePath)), basename(filePath));
    return canonicalPath.startsWith(`${canonicalProjectRoot}${sep}`);
  } catch {
    // An unresolvable path (for example a missing parent directory) is not a usable target.
    return false;
  }
};

if (!isProjectFile(configPath) || !isProjectFile(sdkPath)) {
  console.error("SDK config and output must be TypeScript files inside example-frontend");
  process.exit(1);
}

// The RTK codegen CLI uses ts-node here because this workspace does not install esbuild-runner.
execFile(
  "tsx",
  [cliPath, configPath],
  {env: {...process.env, TS_NODE_PROJECT: tsConfigPath}},
  (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    if (stdout) {
    }

    // Post-process: remove empty export line if it exists
    if (existsSync(sdkPath)) {
      let content = readFileSync(sdkPath, "utf8");
      content = content.replace(/^export const \{\} = injectedRtkApi;\n?/m, "");
      writeFileSync(sdkPath, content, "utf8");
    }

    // Run biome formatting
    execFile(
      "bunx",
      ["biome", "check", "--unsafe", "--write", sdkPath],
      {cwd: join(__dirname, "..")},
      (formatError, formatStdout) => {
        if (formatError) {
          console.error(`Formatting error: ${formatError.message}`);
          process.exit(1);
        }
        if (formatStdout) {
        }
      }
    );
  }
);
