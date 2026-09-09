import {assert} from "chai";
import {describe, it} from "bun:test";
import {AREA_ORDER, TARGET_ORDER} from "../generate-roadmap/lib.ts";
import {
  deriveAreas,
  FIELDS_PATH,
  LABELS_PATH,
  parseFieldOptions,
  parseLabelNames,
  validateRoadmapItem,
} from "./checkRoadmapItem.ts";

const loadRealTaxonomy = async (): Promise<{
  knownLabels: string[];
  options: ReturnType<typeof parseFieldOptions>;
}> => {
  const knownLabels = parseLabelNames(await Bun.file(LABELS_PATH).text());
  const options = parseFieldOptions({
    fieldsContents: await Bun.file(FIELDS_PATH).text(),
    labelNames: knownLabels,
  });
  return {knownLabels, options};
};

describe("deriveAreas", () => {
  it("takes areas from the area:* labels rather than a second list", () => {
    assert.deepEqual(deriveAreas(["area:api", "type:bug", "area:ui"]), ["api", "ui"]);
  });
});

describe("validateRoadmapItem", () => {
  it("accepts a well-formed item", async () => {
    const {knownLabels, options} = await loadRealTaxonomy();

    const problems = validateRoadmapItem({
      item: {
        area: "api",
        impact: "Feature",
        labels: ["area:api", "type:feature"],
        status: "Planned",
        target: "Next",
      },
      knownLabels,
      options,
    });

    assert.isEmpty(problems);
  });

  it("requires the roadmap label only for board items", async () => {
    const {knownLabels, options} = await loadRealTaxonomy();
    const item = {area: "api", labels: ["area:api", "type:feature"]};

    // Triage labels plenty of issues that never reach the board.
    assert.isEmpty(validateRoadmapItem({item, knownLabels, options}));

    assert.isTrue(
      validateRoadmapItem({item, knownLabels, options, requireRoadmapLabel: true}).some((problem) =>
        problem.includes('Needs the "roadmap" label')
      )
    );
    assert.isEmpty(
      validateRoadmapItem({
        item: {...item, labels: [...item.labels, "roadmap"]},
        knownLabels,
        options,
        requireRoadmapLabel: true,
      })
    );
  });

  it("rejects a label that does not exist in the taxonomy", async () => {
    const {knownLabels, options} = await loadRealTaxonomy();

    const problems = validateRoadmapItem({
      item: {labels: ["area:api", "type:feature", "area:nonexistent-thing"]},
      knownLabels,
      options,
    });

    assert.isTrue(problems.some((problem) => problem.includes("not defined in")));
  });

  it("requires exactly one area and one type label", async () => {
    const {knownLabels, options} = await loadRealTaxonomy();

    assert.isTrue(
      validateRoadmapItem({item: {labels: ["type:bug"]}, knownLabels, options}).some((problem) =>
        problem.includes("exactly one area:*")
      )
    );
    assert.isTrue(
      validateRoadmapItem({item: {labels: ["area:api"]}, knownLabels, options}).some((problem) =>
        problem.includes("exactly one type:*")
      )
    );
    assert.isTrue(
      validateRoadmapItem({
        item: {labels: ["area:api", "area:ui", "type:bug"]},
        knownLabels,
        options,
      }).some((problem) => problem.includes("2 area:* labels"))
    );
  });

  it("rejects a Status the Project field does not offer", async () => {
    const {knownLabels, options} = await loadRealTaxonomy();

    const problems = validateRoadmapItem({
      item: {labels: ["area:syncdb", "type:docs"], status: "Blocked"},
      knownLabels,
      options,
    });

    assert.isTrue(problems.some((problem) => problem.startsWith('Status "Blocked"')));
  });

  it("catches an Area field that disagrees with the area label", async () => {
    const {knownLabels, options} = await loadRealTaxonomy();

    const problems = validateRoadmapItem({
      item: {area: "ui", labels: ["area:api", "type:feature"]},
      knownLabels,
      options,
    });

    assert.isTrue(problems.some((problem) => problem.includes("does not match label")));
  });
});

describe("taxonomy drift", () => {
  it("keeps the generator's area ordering in sync with the area:* labels", async () => {
    const {options} = await loadRealTaxonomy();
    assert.deepEqual([...AREA_ORDER], options.areas);
  });

  it("keeps the generator's target ordering in sync with the Project options", async () => {
    const {options} = await loadRealTaxonomy();
    assert.deepEqual([...TARGET_ORDER], options.target);
  });
});
