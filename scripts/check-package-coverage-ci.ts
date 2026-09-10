#!/usr/bin/env bun
/**
 * Fails when a dedicated published-package CI job does not run
 * `bun run test:coverage` (`scripts/check-coverage.ts` at 95%).
 *
 * CircleCI continue-config is the live gate; retained GHA workflows must match.
 */
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";

export const DEDICATED_PACKAGE_CI_JOBS: {circleJob: string; ghaWorkflow: string}[] = [
  {circleJob: "api-ci", ghaWorkflow: "api-ci.yml"},
  {circleJob: "ai-ci", ghaWorkflow: "ai-ci.yml"},
  {circleJob: "rtk-ci", ghaWorkflow: "rtk-ci.yml"},
  {circleJob: "ui-ci", ghaWorkflow: "ui-ci.yml"},
  {circleJob: "syncdb-ci", ghaWorkflow: "syncdb-ci.yml"},
  {circleJob: "comms-ci", ghaWorkflow: "comms-ci.yml"},
  {circleJob: "mcp-server-ci", ghaWorkflow: "mcp-server-ci.yml"},
  {circleJob: "admin-spa-ci", ghaWorkflow: "admin-spa-ci.yml"},
];

export const COVERAGE_COMMAND = "bun run test:coverage";

const repoRootFromMeta = (): string => join(dirname(new URL(import.meta.url).pathname), "..");

export const jobCommandBlock = (source: string, jobName: string): string | null => {
  const marker = `\n  ${jobName}:\n`;
  const start = source.indexOf(marker);
  if (start < 0) {
    return null;
  }
  const rest = source.slice(start + 1);
  const nextJob = rest.search(/\n {2}[a-z0-9-]+:\n/);
  if (nextJob < 0) {
    return rest;
  }
  return rest.slice(0, nextJob);
};

export const sourceRunsCoverage = (source: string): boolean => {
  return source.includes(COVERAGE_COMMAND);
};

export const findDedicatedJobsMissingCoverage = ({
  continueConfig,
  ghaSources,
}: {
  continueConfig: string;
  ghaSources: Record<string, string>;
}): string[] => {
  const missing: string[] = [];
  for (const {circleJob, ghaWorkflow} of DEDICATED_PACKAGE_CI_JOBS) {
    const circleBlock = jobCommandBlock(continueConfig, circleJob);
    if (!circleBlock || !sourceRunsCoverage(circleBlock)) {
      missing.push(`circleci:${circleJob}`);
    }
    const gha = ghaSources[ghaWorkflow] ?? "";
    if (!sourceRunsCoverage(gha)) {
      missing.push(`gha:${ghaWorkflow}`);
    }
  }
  return missing.sort();
};

export const runPackageCoverageCiCheck = (
  repoRoot: string = repoRootFromMeta()
): {missing: string[]; ok: boolean} => {
  const continueConfig = readFileSync(join(repoRoot, ".circleci/continue-config.yml"), "utf8");
  const ghaSources: Record<string, string> = {};
  for (const {ghaWorkflow} of DEDICATED_PACKAGE_CI_JOBS) {
    ghaSources[ghaWorkflow] = readFileSync(
      join(repoRoot, ".github/workflows", ghaWorkflow),
      "utf8"
    );
  }
  const missing = findDedicatedJobsMissingCoverage({continueConfig, ghaSources});
  return {missing, ok: missing.length === 0};
};

const main = (): void => {
  const result = runPackageCoverageCiCheck();
  if (!result.ok) {
    console.error("check-package-coverage-ci: dedicated jobs missing bun run test:coverage:");
    for (const name of result.missing) {
      console.error(`  ${name}`);
    }
    process.exit(1);
  }
  console.info("check-package-coverage-ci: every dedicated package CI job runs test:coverage");
};

if (import.meta.main) {
  main();
}
