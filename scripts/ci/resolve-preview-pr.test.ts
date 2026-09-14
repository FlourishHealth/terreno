import {describe, it} from "bun:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const script = join(import.meta.dir, "resolve-preview-pr.sh");

const run = ({
  env,
  extraPath,
}: {
  env: NodeJS.ProcessEnv;
  extraPath?: string;
}): string => {
  const pathValue = extraPath ? `${extraPath}:${process.env.PATH ?? ""}` : process.env.PATH;
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {...process.env, ...env, PATH: pathValue},
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

describe("resolve-preview-pr.sh", () => {
  it("returns the PR number from CIRCLE_PULL_REQUEST", () => {
    assert.equal(
      run({
        env: {
          CIRCLE_PULL_REQUEST: "https://github.com/FlourishHealth/terreno/pull/1222",
          CIRCLE_PR_NUMBER: "",
          CIRCLE_PR_REPONAME: "",
          CIRCLE_PROJECT_REPONAME: "terreno",
        },
      }),
      "1222"
    );
  });

  it("falls back to CIRCLE_PR_NUMBER", () => {
    assert.equal(
      run({
        env: {
          CIRCLE_PULL_REQUEST: "",
          CIRCLE_PR_NUMBER: "88",
          CIRCLE_PR_REPONAME: "",
          CIRCLE_PROJECT_REPONAME: "terreno",
        },
      }),
      "88"
    );
  });

  it("skips fork PRs", () => {
    assert.equal(
      run({
        env: {
          CIRCLE_PULL_REQUEST: "https://github.com/other/terreno/pull/9",
          CIRCLE_PR_NUMBER: "9",
          CIRCLE_PR_REPONAME: "fork-terreno",
          CIRCLE_PROJECT_REPONAME: "terreno",
        },
      }),
      "skip-fork"
    );
  });

  it("skips builds with no PR", () => {
    assert.equal(
      run({
        env: {
          CIRCLE_PULL_REQUEST: "",
          CIRCLE_PR_NUMBER: "",
          CIRCLE_PR_REPONAME: "",
          CIRCLE_PROJECT_USERNAME: "",
          CIRCLE_PROJECT_REPONAME: "terreno",
          CIRCLE_BRANCH: "feature",
        },
      }),
      "skip-missing"
    );
  });

  it("looks up an open PR from the GitHub API by head branch", () => {
    const dir = mkdtempSync(join(tmpdir(), "resolve-preview-pr-"));
    writeFileSync(
      join(dir, "curl"),
      `#!/usr/bin/env bash
set -euo pipefail
echo '[{"number":1225}]'
`,
      {mode: 0o755}
    );
    mkdirSync(dir, {recursive: true});
    assert.equal(
      run({
        extraPath: dir,
        env: {
          CIRCLE_PULL_REQUEST: "",
          CIRCLE_PR_NUMBER: "",
          CIRCLE_PR_REPONAME: "",
          CIRCLE_PROJECT_USERNAME: "FlourishHealth",
          CIRCLE_PROJECT_REPONAME: "terreno",
          CIRCLE_BRANCH: "cursor/circleci-auto-deploys-5c49",
          GITHUB_API_URL: "http://example.invalid",
        },
      }),
      "1225"
    );
  });
});
