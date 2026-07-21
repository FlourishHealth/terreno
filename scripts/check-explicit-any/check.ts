#!/usr/bin/env bun
/**
 * Audits explicit `any` usage across the monorepo.
 *
 * Day-to-day enforcement of new unsuppressed `any` still happens through Biome lint.
 * This script inventories all explicit `any` usages and classifies remediation status.
 */
import {runCheckExplicitAny} from "./lib";

interface ParsedArgs {
  failOnUndocumented: boolean;
  includeExcluded: boolean;
  json: boolean;
  packageFilter?: string;
  undocumentedOnly: boolean;
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = {
    failOnUndocumented: false,
    includeExcluded: false,
    json: false,
    undocumentedOnly: false,
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
    if (arg.startsWith("--package=")) {
      parsed.packageFilter = arg.slice("--package=".length);
    }
  }

  return parsed;
};

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  const result = runCheckExplicitAny({
    failOnUndocumented: args.failOnUndocumented,
    includeExcluded: args.includeExcluded,
    json: args.json,
    packageFilter: args.packageFilter,
    undocumentedOnly: args.undocumentedOnly,
  });

  if (result.exitCode === 0) {
    console.info(result.text);
  } else {
    console.error(result.text);
  }

  process.exit(result.exitCode);
};

main();
