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

  it("rejects an unbounded Taste wait loop", (): void => {
    const errors = validateStageContent({
      content: `${readStage("terreno-5-taste")}\nKeep the loop active until all CI is green.`,
      definition: {
        directory: "terreno-5-taste",
        nextMarkers: ["next: taste", "next: null"],
        stage: "taste",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("unbounded waiting/loop")));
  });

  it("rejects Taste without a no-push emit path", (): void => {
    const errors = validateStageContent({
      content: readStage("terreno-5-taste").replace(
        "If step 8 did not push",
        "After step 8 pushed"
      ),
      definition: {
        directory: "terreno-5-taste",
        nextMarkers: ["next: taste", "next: null"],
        stage: "taste",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("emit path when no fix was pushed")));
  });

  it("rejects Brew that exits while review bots are running", (): void => {
    const content = readStage("terreno-4-brew")
      .replace("../../references/async-review-bots.md", "missing-bots")
      .replaceAll("Do not exit while", "Exit immediately while");
    const errors = validateStageContent({
      content,
      definition: {
        directory: "terreno-4-brew",
        nextMarkers: ["next: taste"],
        stage: "brew",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("async review-bot wait")));
    assert.isTrue(errors.some((error) => error.includes("wait in-process for running review bots")));
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

  it("keeps planning-loop and taste-sweep as non-stage plugin skills", (): void => {
    for (const directory of ["terreno-planning-loop", "terreno-taste-sweep"] as const) {
      const content = readStage(directory);
      assert.include(content, `name: ${directory}`);
      assert.include(content, "disable-model-invocation: true");
      assert.include(content, "../../references/lifecycle-contract.md");
    }
  });
});
