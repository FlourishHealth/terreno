#!/usr/bin/env bun
/**
 * Fails when a GitHub Actions `paths:` filter has no CircleCI path-filtering
 * mapping, which would let the CircleCI twin pass without ever running.
 *
 * Policy: docs/how-to/circleci.md
 */
import {dirname, join} from "node:path";

import {collectParityGaps, WORKFLOW_PARAMETERS} from "./lib";

const REPO_ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..");

const main = (): void => {
  const gaps = collectParityGaps({repoRoot: REPO_ROOT});

  if (gaps.length > 0) {
    console.error(`check-circleci-parity: found ${gaps.length} unmapped path filter(s):\n`);
    for (const gap of gaps) {
      console.error(`  ${gap.workflow}.yml: "${gap.path}" never sets ${gap.parameter}`);
    }
    console.error(
      "\nAdd the path to the mapping in .circleci/config.setup.yml (or config.yml) so the CircleCI twin runs. See docs/how-to/circleci.md"
    );
    process.exit(1);
  }

  console.info(
    `check-circleci-parity: all GHA path filters map to CircleCI parameters (${Object.keys(WORKFLOW_PARAMETERS).length} workflows)`
  );
};

main();
