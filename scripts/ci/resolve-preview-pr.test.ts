import {describe, it} from "bun:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {join} from "node:path";

const script = join(import.meta.dir, "resolve-preview-pr.sh");

const run = (env: NodeJS.ProcessEnv): string => {
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {...process.env, ...env},
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

describe("resolve-preview-pr.sh", () => {
  it("returns the PR number from CIRCLE_PULL_REQUEST", () => {
    assert.equal(
      run({
        CIRCLE_PULL_REQUEST: "https://github.com/FlourishHealth/terreno/pull/1222",
        CIRCLE_PR_NUMBER: "",
        CIRCLE_PR_REPONAME: "",
        CIRCLE_PROJECT_REPONAME: "terreno",
      }),
      "1222"
    );
  });

  it("falls back to CIRCLE_PR_NUMBER", () => {
    assert.equal(
      run({
        CIRCLE_PULL_REQUEST: "",
        CIRCLE_PR_NUMBER: "88",
        CIRCLE_PR_REPONAME: "",
        CIRCLE_PROJECT_REPONAME: "terreno",
      }),
      "88"
    );
  });

  it("skips fork PRs", () => {
    assert.equal(
      run({
        CIRCLE_PULL_REQUEST: "https://github.com/other/terreno/pull/9",
        CIRCLE_PR_NUMBER: "9",
        CIRCLE_PR_REPONAME: "fork-terreno",
        CIRCLE_PROJECT_REPONAME: "terreno",
      }),
      "skip-fork"
    );
  });

  it("skips builds with no PR", () => {
    assert.equal(
      run({
        CIRCLE_PULL_REQUEST: "",
        CIRCLE_PR_NUMBER: "",
        CIRCLE_PR_REPONAME: "",
        CIRCLE_PROJECT_REPONAME: "terreno",
      }),
      "skip-missing"
    );
  });
});
