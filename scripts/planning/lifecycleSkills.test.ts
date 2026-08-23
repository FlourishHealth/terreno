import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {assert} from "chai";
import {describe, it} from "bun:test";
import {
  validateDocumentationContract,
  validateGithubAttentionContract,
  validateLifecyclePlugin,
  validateStageContent,
} from "./lifecycleSkills.ts";

const ROOT_DIRECTORY = resolve(import.meta.dir, "../..");

const readStage = (directory: string): string =>
  readFileSync(
    resolve(ROOT_DIRECTORY, "plugins/terreno-planning/skills", directory, "SKILL.md"),
    "utf8"
  );

describe("lifecycle skill architecture", (): void => {
  it("validates the real plugin lifecycle", (): void => {
    assert.deepEqual(validateLifecyclePlugin({rootDirectory: ROOT_DIRECTORY}), []);
  });

  it("rejects an internal Taste wait loop", (): void => {
    const errors = validateStageContent({
      content: `${readStage("terreno-5-taste")}\nRun sleep 180 before checking again.`,
      definition: {
        directory: "terreno-5-taste",
        nextMarkers: ["next: taste", "next: null"],
        stage: "taste",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("internal waiting/loop")));
  });

  it("rejects same-invocation Brew to Taste execution", (): void => {
    const errors = validateStageContent({
      content: `${readStage("terreno-4-brew")}\nExecute Taste procedure now.`,
      definition: {
        directory: "terreno-4-brew",
        nextMarkers: ["next: taste"],
        stage: "brew",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("must not execute Taste")));
  });

  it("rejects repository-specific commands in portable stages", (): void => {
    const errors = validateStageContent({
      content: `${readStage("terreno-2-pick")}\nRun bun run lint.`,
      definition: {
        directory: "terreno-2-pick",
        nextMarkers: ["next: roast"],
        stage: "pick",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("repository-specific marker")));
  });

  it("rejects a missing non-pass transition marker", (): void => {
    const content = readStage("terreno-1-grow").replace(
      "next: grow",
      "missing-grow-retry"
    );
    const errors = validateStageContent({
      content,
      definition: {
        directory: "terreno-1-grow",
        nextMarkers: ["next: pick", "next: grow"],
        stage: "grow",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("next: grow")));
  });

  it("rejects verbose or incomplete GitHub communication contracts", (): void => {
    const errors = validateGithubAttentionContract(`
## Summary
## What changed
## Verification
`);

    assert.isTrue(errors.some((error) => error.includes("missing required heading ## Why")));
    assert.isTrue(errors.some((error) => error.includes("forbidden heading ## Summary")));
    assert.isTrue(errors.some((error) => error.includes("default PR comments to silence")));
    assert.isTrue(errors.some((error) => error.includes("behind disclosure")));
  });

  it("rejects a documentation contract that does not require reading and updating docs", (): void => {
    const errors = validateDocumentationContract("# Docs\nWrite something later.");

    assert.isTrue(errors.some((error) => error.includes("Always read docs first")));
    assert.isTrue(errors.some((error) => error.includes("Always update docs")));
    assert.isTrue(errors.some((error) => error.includes("Diátaxis")));
  });

  it("rejects a stage that does not load the documentation contract", (): void => {
    const content = readStage("terreno-2-pick").replace(
      "../../references/documentation-contract.md",
      "missing-docs-contract"
    );
    const errors = validateStageContent({
      content,
      definition: {
        directory: "terreno-2-pick",
        nextMarkers: ["next: roast"],
        stage: "pick",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("documentation contract")));
  });

  it("rejects Grow that skips grilling or the Decisions table", (): void => {
    const content = readStage("terreno-1-grow")
      .replace("references/grilling.md", "missing-grilling")
      .replace("Decisions table", "compressed one-liner");
    const errors = validateStageContent({
      content,
      definition: {
        directory: "terreno-1-grow",
        nextMarkers: ["next: pick", "next: grow", "next: null"],
        stage: "grow",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("grilling procedure")));
    assert.isTrue(errors.some((error) => error.includes("Decisions table")));
  });
});
