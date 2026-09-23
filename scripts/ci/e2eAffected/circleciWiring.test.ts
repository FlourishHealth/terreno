import {describe, it} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {assert} from "chai";

import {jobCommandBlock} from "../../check-package-coverage-ci";
import {pullRequestShards} from "./shards";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const CONTINUE_CONFIG = readFileSync(join(REPO_ROOT, ".circleci/continue-config.yml"), "utf8");

describe("CircleCI e2e affected gate", () => {
  it("resolves the decision in e2e-prepare and persists it", () => {
    const block = jobCommandBlock(CONTINUE_CONFIG, "e2e-prepare");
    assert.ok(block);
    assert.include(block, "resolve_affected_e2e_shards");
    assert.include(block, "e2e-affected.json");
  });

  it("halts an unaffected shard before installing dependencies", () => {
    const block = jobCommandBlock(CONTINUE_CONFIG, "e2e");
    assert.ok(block);
    const haltAt = block.indexOf("halt_if_shard_unaffected");
    const installAt = block.indexOf("install_bun_and_deps");
    assert.notEqual(haltAt, -1);
    assert.notEqual(installAt, -1);
    assert.isBelow(haltAt, installAt, "the gate must run before bun install");
  });

  it("keeps the workflow matrix and the shard definitions in step", () => {
    const matrix = CONTINUE_CONFIG.slice(CONTINUE_CONFIG.indexOf("\n  e2e:\n    when:"));
    for (const shard of pullRequestShards()) {
      assert.include(matrix, `- ${shard.name}\n`, shard.name);
    }
  });
});
