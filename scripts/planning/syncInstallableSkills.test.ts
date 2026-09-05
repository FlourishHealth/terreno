import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {assert} from "chai";
import {describe, it} from "bun:test";
import {
  buildInstallableSkillsTree,
  rewritePluginLinksForInstallable,
  rewriteSharedPluginLinks,
  syncInstallableSkills,
  validateSkillGroupings,
} from "./syncInstallableSkills.ts";

const ROOT_DIRECTORY = resolve(import.meta.dir, "../..");

const writeFile = (path: string, contents: string): void => {
  mkdirSync(join(path, ".."), {recursive: true});
  writeFileSync(path, contents);
};

describe("installable skills sync", (): void => {
  it("rewrites portable plugin reference links for a copied skill", (): void => {
    assert.equal(
      rewriteSharedPluginLinks("See [docs](../../references/documentation-contract.md)."),
      "See [docs](references/documentation-contract.md)."
    );
  });

  it("rewrites plugin-root docs links for the installable tree", (): void => {
    assert.equal(
      rewritePluginLinksForInstallable(
        "[skill](../../../../docs/reference/api.md) [ref](../../../../../docs/reference/ui.md)"
      ),
      "[skill](../../docs/reference/api.md) [ref](../../../docs/reference/ui.md)"
    );
  });

  it("uses the combined plugin as the installable Terreno skill source", (): void => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "terreno-skills-"));
    try {
      writeFile(
        join(fixtureRoot, ".rulesync/skills/mongoose-schema-safety/SKILL.md"),
        "from-rulesync\n"
      );
      writeFile(
        join(fixtureRoot, "plugins/terreno-planning/skills/terreno-1-grow/SKILL.md"),
        "Read [lifecycle](../../references/lifecycle-contract.md)\n"
      );
      writeFile(
        join(fixtureRoot, "plugins/terreno-planning/skills/mongoose-schema-safety/SKILL.md"),
        "from-plugin\n"
      );
      writeFile(
        join(fixtureRoot, "plugins/terreno-planning/references/lifecycle-contract.md"),
        "lifecycle\n"
      );
      writeFile(
        join(fixtureRoot, "plugins/terreno-planning/references/product-ci.md"),
        "product-ci-should-not-copy\n"
      );
      writeFile(
        join(fixtureRoot, "api/.ai/skills/mongoose-schema-safety/SKILL.md"),
        "from-package\n"
      );

      const destination = join(fixtureRoot, "skills");
      buildInstallableSkillsTree({destination, rootDirectory: fixtureRoot});

      assert.equal(
        readFileSync(join(destination, "mongoose-schema-safety/SKILL.md"), "utf8"),
        "from-plugin\n"
      );
      assert.equal(
        readFileSync(join(destination, "terreno-1-grow/SKILL.md"), "utf8"),
        "Read [lifecycle](references/lifecycle-contract.md)\n"
      );
      assert.equal(
        readFileSync(
          join(destination, "terreno-1-grow/references/lifecycle-contract.md"),
          "utf8"
        ),
        "lifecycle\n"
      );
      assert.isFalse(
        existsSync(join(destination, "terreno-1-grow/references/product-ci.md"))
      );
    } finally {
      rmSync(fixtureRoot, {force: true, recursive: true});
    }
  });

  it("keeps the committed installable tree in sync", (): void => {
    assert.deepEqual(syncInstallableSkills({check: true, rootDirectory: ROOT_DIRECTORY}), []);
  });

  it("does not copy unused plugin references into Roast", (): void => {
    assert.isFalse(
      existsSync(join(ROOT_DIRECTORY, "skills/terreno-3-roast/references/product-ci.md"))
    );
    assert.isFalse(
      existsSync(join(ROOT_DIRECTORY, "skills/terreno-3-roast/references/independent-review.md"))
    );
    assert.isTrue(
      existsSync(join(ROOT_DIRECTORY, "skills/terreno-3-roast/references/subagent-briefing.md"))
    );
    assert.isTrue(
      existsSync(join(ROOT_DIRECTORY, "skills/terreno-4-brew/references/product-ci.md"))
    );
  });

  it("rejects an ungrouped installable skill", (): void => {
    const errors = validateSkillGroupings(["terreno-1-grow", "mystery-skill"]);
    assert.isTrue(errors.some((error) => error.includes("mystery-skill")));
  });
});
