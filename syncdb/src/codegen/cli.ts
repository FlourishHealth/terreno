#!/usr/bin/env bun

import {parseArgs} from "node:util";

import {generateSyncDbSdk, loadConfigFile, parseCollectionsFlag} from "./generate";

const printUsage = (): void => {
  console.error(`Usage: terreno-syncdb-codegen --schema <url|path> --out <file> [options]

Options:
  --schema <url|path>     OpenAPI document (required)
  --out <file>            Output TypeScript path (required)
  --collections a,b       Allowlist / fallback collection names
  --config <json>         Optional {overrides: {todos: {retries: false}}}
  --no-format             Skip biome formatting
`);
};

const main = async (): Promise<void> => {
  const {values} = parseArgs({
    allowPositionals: false,
    options: {
      collections: {type: "string"},
      config: {type: "string"},
      "no-format": {default: false, type: "boolean"},
      out: {type: "string"},
      schema: {type: "string"},
    },
    strict: true,
  });

  if (!values.schema || !values.out) {
    printUsage();
    process.exit(1);
  }

  try {
    await generateSyncDbSdk({
      collections: parseCollectionsFlag(values.collections),
      config: await loadConfigFile(values.config),
      format: values["no-format"] !== true,
      out: values.out,
      schema: values.schema,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
};

void main();
