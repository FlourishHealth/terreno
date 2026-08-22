import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {assert} from "chai";
import {describe, it} from "bun:test";
import {validateLifecyclePlugin, validateStageContent} from "./lifecycleSkills.ts";

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
        nextMarkers: ["recommended_next_stage: taste", "recommended_next_stage: null"],
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
        nextMarkers: ["recommended_next_stage: taste"],
        stage: "brew",
      },
    });

    assert.isTrue(errors.some((error) => error.includes("must not execute Taste")));
  });
});

