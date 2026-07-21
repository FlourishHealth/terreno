#!/usr/bin/env bun
/**
 * Audits explicit `any` usage across the monorepo.
 *
 * Day-to-day enforcement of new unsuppressed `any` still happens through Biome lint.
 * This script inventories all explicit `any` usages and classifies remediation status.
 */
import {runCheckExplicitAny} from "./lib";

interface ParsedArgs {
  baselinePath?: string;
  checkBaseline: boolean;
  failOnUndocumented: boolean;
  includeExcluded: boolean;
  json: boolean;
  list: boolean;
  maxCount?: number;
  packageFilter?: string;
  productionOnly: boolean;
  undocumentedOnly: boolean;
  writeBaseline: boolean;
}

const parsePositiveInt = (value: string, flagName: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${flagName} requires a non-negative integer`);
  }
  return parsed;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = {
    checkBaseline: false,
    failOnUndocumented: false,
    includeExcluded: false,
    json: false,
    list: false,
    productionOnly: false,
    undocumentedOnly: false,
    writeBaseline: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--include-excluded") {
      parsed.includeExcluded = true;
      continue;
    }
    if (arg === "--undocumented") {
      parsed.undocumentedOnly = true;
      continue;
    }
    if (arg === "--fail-on-undocumented") {
      parsed.failOnUndocumented = true;
      continue;
    }
    if (arg === "--check-baseline") {
      parsed.checkBaseline = true;
      continue;
    }
    if (arg === "--write-baseline") {
      parsed.writeBaseline = true;
      continue;
    }
    if (arg === "--list") {
      parsed.list = true;
      continue;
    }
    if (arg === "--production-only") {
      parsed.productionOnly = true;
      continue;
    }
    if (arg.startsWith("--package=")) {
      parsed.packageFilter = arg.slice("--package=".length);
      continue;
    }
    if (arg.startsWith("--baseline=")) {
      parsed.baselinePath = arg.slice("--baseline=".length);
      continue;
    }
    if (arg.startsWith("--max-count=")) {
      parsed.maxCount = parsePositiveInt(arg.slice("--max-count=".length), "--max-count");
    }
  }

  return parsed;
};

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  const result = runCheckExplicitAny({
    baselinePath: args.baselinePath,
    checkBaseline: args.checkBaseline,
    failOnUndocumented: args.failOnUndocumented,
    includeExcluded: args.includeExcluded,
    json: args.json,
    list: args.list,
    maxCount: args.maxCount,
    packageFilter: args.packageFilter,
    productionOnly: args.productionOnly,
    undocumentedOnly: args.undocumentedOnly,
    writeBaseline: args.writeBaseline,
  });

  if (result.exitCode === 0) {
    console.info(result.text);
  } else {
    console.error(result.text);
  }

  process.exit(result.exitCode);
};

main();
