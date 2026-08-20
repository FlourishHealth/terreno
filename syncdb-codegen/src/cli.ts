#!/usr/bin/env bun

import {readFile} from "node:fs/promises";
import {parseArgs} from "node:util";
import {writeFile} from "node:fs/promises";

import {discoverCollections} from "./discoverCollections";
import {emitSdk} from "./emitSdk";
import {formatOutput} from "./formatOutput";
import {loadSpec} from "./loadSpec";
import type {CodegenConfigFile} from "./types";

const USAGE = `Usage: terreno-syncdb-codegen --schema <url|path> --out <file> [--collections a,b] [--config <json>] [--no-format]`;

export interface CliArgs {
  schema: string;
  out: string;
  collections?: string[];
  config?: CodegenConfigFile;
  noFormat: boolean;
}

export const parseCliArgs = async (argv: string[]): Promise<CliArgs> => {
  const {values} = parseArgs({
    args: argv,
    options: {
      collections: {type: "string"},
      config: {type: "string"},
      "no-format": {type: "boolean", default: false},
      out: {type: "string"},
      schema: {type: "string"},
    },
    strict: true,
    allowPositionals: false,
  });

  if (!values.schema || !values.out) {
    throw new Error(`${USAGE}\nMissing required --schema and/or --out.`);
  }

  const collections = values.collections
    ? values.collections.split(",").map((entry) => entry.trim()).filter(Boolean)
    : undefined;

  let config: CodegenConfigFile | undefined;
  if (values.config) {
    const raw = await readFile(values.config, "utf8");
    config = JSON.parse(raw) as CodegenConfigFile;
  }

  return {
    collections,
    config,
    noFormat: values["no-format"] ?? false,
    out: values.out,
    schema: values.schema,
  };
};

export const runCodegen = async (args: CliArgs): Promise<string> => {
  const doc = await loadSpec(args.schema);
  const collections = discoverCollections({
    collectionsArg: args.collections,
    config: args.config,
    doc,
  });
  const raw = emitSdk({collections, config: args.config, doc});
  return formatOutput({content: raw, noFormat: args.noFormat});
};

export const main = async (argv: string[]): Promise<number> => {
  try {
    const args = await parseCliArgs(argv);
    const output = await runCodegen(args);
    await writeFile(args.out, output, "utf8");
    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error(USAGE);
    return 1;
  }
};

if (import.meta.main) {
  const exitCode = await main(process.argv.slice(2));
  process.exit(exitCode);
}
