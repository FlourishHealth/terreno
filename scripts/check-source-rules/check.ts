#!/usr/bin/env bun
/**
 * Fails when scoped production TypeScript sources trip the six Terreno
 * source rules (arrow functions, Luxon, APIError, logging, findOne, as any).
 *
 * Policy: docs/explanation/source-rules.md
 */
import {dirname, join} from "node:path";

import {collectSourceRuleViolations, formatViolationReport} from "./lib";

const REPO_ROOT = join(dirname(new URL(import.meta.url).pathname), "../..");

const main = (): void => {
  const violations = collectSourceRuleViolations(REPO_ROOT);
  if (violations.length > 0) {
    console.error(formatViolationReport(violations));
    process.exit(1);
  }
  console.info("check-source-rules: OK (no production source-rule violations)");
};

main();
