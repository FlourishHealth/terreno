import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {assert} from "chai";
import {describe, it} from "bun:test";
import {
  buildClaudePluginFiles,
  rewriteStageNames,
  shortenStageName,
  syncClaudePlugin,
} from "./syncClaudePlugin.ts";

const ROOT_DIRECTORY = resolve(import.meta.dir, "../..");

describe("Claude plugin sync", (): void => {
  it("shortens canonical stage names", (): void => {
    assert.equal(shortenStageName("terreno-1-grow"), "1-grow");
    assert.equal(shortenStageName("terreno-5-taste"), "5-taste");
  });

  it("rewrites stage frontmatter without touching the plugin directory name", (): void => {
    assert.equal(
      rewriteStageNames("name: terreno-1-grow\nSee plugins/terreno-planning/references/x.md"),
      "name: 1-grow\nSee plugins/terreno-planning/references/x.md"
    );
  });

  it("keeps the committed Claude plugin tree in sync", (): void => {
    assert.deepEqual(syncClaudePlugin({check: true, rootDirectory: ROOT_DIRECTORY}), []);
  });

  it("emits shortened skills, shared references, and a terreno manifest", (): void => {
    const files = buildClaudePluginFiles({rootDirectory: ROOT_DIRECTORY});
    const paths = files.map(({path}) => path);

    assert.include(paths, "skills/1-grow/SKILL.md");
    assert.include(paths, "skills/5-taste/SKILL.md");
    assert.include(paths, "references/lifecycle-contract.md");
    assert.notInclude(paths, "skills/terreno-1-grow/SKILL.md");

    const grow = files.find(({path}) => path === "skills/1-grow/SKILL.md");
    assert.include(grow?.contents ?? "", "name: 1-grow");
    assert.include(grow?.contents ?? "", "../../references/lifecycle-contract.md");

    const manifest = JSON.parse(
      files.find(({path}) => path === ".claude-plugin/plugin.json")?.contents ?? "{}"
    ) as {name: string; skills: string; version: string};
    const cursorManifest = JSON.parse(
      readFileSync(
        resolve(ROOT_DIRECTORY, "plugins/terreno-planning/.cursor-plugin/plugin.json"),
        "utf8"
      )
    ) as {version: string};

    assert.equal(manifest.name, "terreno");
    assert.equal(manifest.skills, "./skills/");
    assert.equal(manifest.version, cursorManifest.version);
  });
});
