#!/usr/bin/env bun
import {existsSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {checkUpgradeDocumentation} from "./lib";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const getVersion = (): string => {
  const versionArgument = process.argv[2];

  if (versionArgument) {
    return versionArgument;
  }

  if (process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }

  console.error(
    "check-upgrade-docs: provide a release version argument or set GITHUB_REF_NAME",
  );
  process.exit(1);
};

const main = (): void => {
  const version = getVersion();
  const changelogPath = join(REPO_ROOT, "CHANGELOG.md");
  const upgradeNotePath = join(
    REPO_ROOT,
    "mcp-server",
    "src",
    "docs",
    "upgrades",
    `${version}.md`,
  );
  const result = checkUpgradeDocumentation({
    changelog: readFileSync(changelogPath, "utf8"),
    hasUpgradeNote: existsSync(upgradeNotePath),
    version,
  });

  if (result.isValid) {
    console.info(`check-upgrade-docs: OK — ${result.message}`);
    return;
  }

  console.error(`check-upgrade-docs: ${result.message}`);
  process.exit(1);
};

main();
