import assert from "node:assert/strict";
import {describe, it} from "bun:test";

import {parseFieldOptions, parseLabelNames} from "./checkRoadmapItem.ts";
import {parseBackfillTable, parseProjectFields, parseSeedIssues} from "./seedIssues.ts";
import {
  COMMUNITY_FIELD_NAME,
  IP_FIELD_NAME,
  buildDesiredFields,
  planFields,
  resolveSeedItems,
  validateItems,
} from "./syncProject.ts";

const SEED_DOC = `# Roadmap seed issues

---

## alpha-ip

**Title:** \`[Roadmap] Alpha thing\`

**Labels:** \`area:api\`, \`type:feature\`
**Project fields:** Area=\`api\`, Target=\`Next\`, Impact=\`Feature\`, IP=\`alpha-ip\`, Status=\`Planned\`

Alpha body line one.

- **Implementation plan:** somewhere.md

---

## no-ip-yet

**Title:** \`[Roadmap] Not designed yet\`

**Labels:** \`area:ui\`, \`type:feature\`
**Project fields:** Area=\`ui\`, Target=\`Future\`, Impact=\`Feature\`, IP=*(not yet written)*, Status=\`Planned\`

Body for the undesigned item.

---

# Shipped, umbrella, and declined IPs

| IP slug | GitHub issue | Status | Area | Target | Impact | Type |
|---------|--------------|--------|------|--------|--------|------|
| \`alpha-ip\` | https://github.com/FlourishHealth/terreno/issues/42 | \`Planned\` | \`api\` | \`Next\` | \`Feature\` | \`type:feature\` |
| \`shipped-thing\` | https://github.com/FlourishHealth/terreno/issues/43 | \`Shipped\` | \`dx\` | \`Released\` | \`Improvement\` | \`type:chore\` |
`;

describe("parseProjectFields", () => {
  it("reads backticked values", () => {
    const fields = parseProjectFields("**Project fields:** Area=`api`, Target=`Next`, Status=`Planned`");
    assert.equal(fields.Area, "api");
    assert.equal(fields.Target, "Next");
    assert.equal(fields.Status, "Planned");
  });

  it("treats an unwritten IP as empty", () => {
    const fields = parseProjectFields("**Project fields:** IP=*(not yet written)*, Status=`Planned`");
    assert.equal(fields.IP, "");
    assert.equal(fields.Status, "Planned");
  });
});

describe("parseBackfillTable", () => {
  it("reads every field column and the issue number", () => {
    const rows = parseBackfillTable(SEED_DOC);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], {
      area: "dx",
      body: null,
      impact: "Improvement",
      ip: "shipped-thing",
      issueNumber: 43,
      labels: ["area:dx", "type:chore"],
      slug: "shipped-thing",
      status: "Shipped",
      target: "Released",
      title: "",
    });
  });
});

describe("parseSeedIssues", () => {
  it("parses sections and table rows together", () => {
    const seeds = parseSeedIssues(SEED_DOC);
    assert.equal(seeds.filter((seed) => seed.body !== null).length, 2);
    assert.equal(seeds.filter((seed) => seed.body === null).length, 2);

    const alpha = seeds.find((seed) => seed.slug === "alpha-ip" && seed.body !== null);
    assert.equal(alpha?.title, "[Roadmap] Alpha thing");
    assert.deepEqual(alpha?.labels, ["area:api", "type:feature"]);
    assert.ok(alpha?.body?.includes("Alpha body line one."));
    assert.ok(!alpha?.body?.includes("**Project fields:**"));
  });
});

describe("resolveSeedItems", () => {
  const seeds = parseSeedIssues(SEED_DOC);

  it("merges a section with its table row instead of duplicating the slug", () => {
    const {items} = resolveSeedItems({issueNumbersByTitle: new Map(), seeds});
    const alpha = items.filter((item) => item.slug === "alpha-ip");
    assert.equal(alpha.length, 1);
    // The section supplies the body; the table supplies the issue number.
    assert.equal(alpha[0]?.issueNumber, 42);
    assert.ok(alpha[0]?.body?.includes("Alpha body line one."));
  });

  it("skips entries with no IP and no issue rather than opening speculative work", () => {
    const {items, skipped} = resolveSeedItems({issueNumbersByTitle: new Map(), seeds});
    assert.ok(!items.some((item) => item.slug === "no-ip-yet"));
    assert.deepEqual(
      skipped.map((entry) => entry.slug),
      ["no-ip-yet"]
    );
  });

  it("falls back to matching an existing issue by title", () => {
    const {items} = resolveSeedItems({
      issueNumbersByTitle: new Map([["[Roadmap] Not designed yet", 99]]),
      seeds,
    });
    assert.equal(items.find((item) => item.slug === "no-ip-yet")?.issueNumber, 99);
  });
});

describe("buildDesiredFields", () => {
  it("declares the six board fields from the taxonomy files", () => {
    const fields = buildDesiredFields({
      options: {areas: ["api", "ui"], impact: ["Feature"], status: ["Planned"], target: ["Next"]},
    });
    assert.deepEqual(
      fields.map((field) => field.name),
      ["Status", "Area", "Target", "Impact", IP_FIELD_NAME, COMMUNITY_FIELD_NAME]
    );
    assert.deepEqual(fields.find((field) => field.name === "Area")?.options, ["api", "ui"]);
    assert.equal(fields.find((field) => field.name === IP_FIELD_NAME)?.dataType, "TEXT");
    assert.equal(fields.find((field) => field.name === COMMUNITY_FIELD_NAME)?.dataType, "NUMBER");
  });
});

describe("planFields", () => {
  const desired = buildDesiredFields({
    options: {areas: ["api"], impact: ["Feature"], status: ["Planned", "Shipped"], target: ["Next"]},
  });

  it("plans creation for every field on an empty board", () => {
    const plan = planFields({desired, existing: []});
    assert.equal(plan.create.length, 6);
    assert.equal(plan.rewriteOptions.length, 0);
    assert.equal(plan.conflicts.length, 0);
  });

  it("keeps existing options when adding a missing one", () => {
    const plan = planFields({
      desired,
      existing: [
        {dataType: "SINGLE_SELECT", id: "F1", name: "Status", options: [{id: "o1", name: "Planned"}]},
      ],
    });
    const rewrite = plan.rewriteOptions.find((entry) => entry.field.name === "Status");
    assert.deepEqual(rewrite?.missing, ["Shipped"]);
    // Existing option names must survive the rewrite or cards lose their value.
    assert.deepEqual(rewrite?.desired, ["Planned", "Shipped"]);
  });

  it("reports nothing to do when the board already matches", () => {
    const plan = planFields({
      desired: [{dataType: "SINGLE_SELECT", name: "Status", options: ["Planned"]}],
      existing: [
        {dataType: "SINGLE_SELECT", id: "F1", name: "Status", options: [{id: "o1", name: "Planned"}]},
      ],
    });
    assert.equal(plan.create.length, 0);
    assert.equal(plan.rewriteOptions.length, 0);
  });

  it("flags a data type mismatch instead of silently rewriting it", () => {
    const plan = planFields({
      desired: [{dataType: "TEXT", name: IP_FIELD_NAME, options: []}],
      existing: [{dataType: "SINGLE_SELECT", id: "F9", name: IP_FIELD_NAME, options: []}],
    });
    assert.equal(plan.create.length, 0);
    assert.equal(plan.conflicts.length, 1);
    assert.ok(plan.conflicts[0]?.includes(IP_FIELD_NAME));
  });
});

describe("validateItems", () => {
  it("catches a board Area that disagrees with the issue label", async () => {
    const knownLabels = parseLabelNames(await Bun.file(".github/labels.yml").text());
    const options = parseFieldOptions({
      fieldsContents: await Bun.file(".github/roadmap-fields.yml").text(),
      labelNames: knownLabels,
    });

    const problems = validateItems({
      items: [
        {
          area: "ui",
          body: null,
          impact: "Feature",
          ip: "x",
          issueNumber: 1,
          labels: ["area:api", "type:feature"],
          slug: "mismatched",
          status: "Planned",
          target: "Next",
          title: "t",
        },
      ],
      knownLabels,
      options,
    });

    assert.equal(problems.length, 1);
    assert.ok(problems[0]?.startsWith("mismatched:"));
  });
});

describe("the real seed document", () => {
  it("declares only valid labels and field values for every board item", async () => {
    const knownLabels = parseLabelNames(await Bun.file(".github/labels.yml").text());
    const options = parseFieldOptions({
      fieldsContents: await Bun.file(".github/roadmap-fields.yml").text(),
      labelNames: knownLabels,
    });
    const seeds = parseSeedIssues(await Bun.file("docs/explanation/roadmap-seed-issues.md").text());
    const {items} = resolveSeedItems({issueNumbersByTitle: new Map(), seeds});

    assert.ok(items.length > 0, "expected the seed document to yield board items");
    assert.deepEqual(validateItems({items, knownLabels, options}), []);
  });

  it("maps each IP slug to exactly one board item", async () => {
    const seeds = parseSeedIssues(await Bun.file("docs/explanation/roadmap-seed-issues.md").text());
    const {items} = resolveSeedItems({issueNumbersByTitle: new Map(), seeds});
    const slugs = items.map((item) => item.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });
});
