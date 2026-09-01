import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {assert} from "chai";
import {describe, it} from "bun:test";

const ROOT_DIRECTORY = resolve(import.meta.dir, "../..");

describe("improve-rulesync homes", (): void => {
  it("splits user-facing docs from agent-facing rules with cross-links", (): void => {
    const skill = readFileSync(
      resolve(ROOT_DIRECTORY, ".rulesync/skills/improve-rulesync/SKILL.md"),
      "utf8"
    );
    assert.include(skill, "docs/");
    assert.include(skill, ".ai/");
    assert.match(skill, /cross-link/i);
    assert.match(skill, /do not duplicate/i);
  });
});
