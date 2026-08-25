import {assert} from "chai";
import {describe, it} from "bun:test";
import {AREA_BY_PACKAGE, parsePackageAreaFromIssueBody} from "./issueAreaLabels.ts";

describe("parsePackageAreaFromIssueBody", () => {
  it("maps bug report package values to area labels", (): void => {
    const body = "### Affected package\n\n@terreno/ui\n\n### Version";
    assert.equal(parsePackageAreaFromIssueBody(body), "area:ui");
  });

  it("returns null when package section is missing", (): void => {
    assert.isNull(parsePackageAreaFromIssueBody("No package here"));
  });

  it("returns null for a package outside the table", (): void => {
    assert.isNull(parsePackageAreaFromIssueBody("### Affected package\n\n@terreno/unknown\n"));
  });

  it("maps every package in the table to a label the taxonomy defines", async (): Promise<void> => {
    const labelsYaml = await Bun.file(".github/labels.yml").text();
    const definedNames = new Set(
      (Bun.YAML.parse(labelsYaml) as {name: string}[]).map((label) => label.name)
    );

    for (const areaLabel of Object.values(AREA_BY_PACKAGE)) {
      assert.isTrue(
        definedNames.has(areaLabel),
        `${areaLabel} is not defined in .github/labels.yml`
      );
    }
  });
});

describe("dropdown coverage", (): void => {
  // The mapping silently returned "no area" for @terreno/comms for as long as
  // that option existed, because nothing asserted the two lists agree.
  it("maps every package option in bug_report.yml", async (): Promise<void> => {
    const template = await Bun.file(".github/ISSUE_TEMPLATE/bug_report.yml").text();
    const parsed = Bun.YAML.parse(template) as {
      body?: {attributes?: {label?: string; options?: string[]}; type?: string}[];
    };

    const packageDropdown = parsed.body?.find(
      (block) => block.type === "dropdown" && /affected package/i.test(block.attributes?.label ?? "")
    );
    assert.ok(packageDropdown !== undefined, "bug_report.yml has no Affected package dropdown");

    const unmapped = (packageDropdown?.attributes?.options ?? []).filter(
      (option) => AREA_BY_PACKAGE[option] === undefined
    );
    assert.deepEqual(unmapped, [], `unmapped package options: ${unmapped.join(", ")}`);
  });

  it("only maps to labels that exist in labels.yml", async (): Promise<void> => {
    const labels = Bun.YAML.parse(await Bun.file(".github/labels.yml").text()) as {name: string}[];
    const known = new Set(labels.map((label) => label.name));
    const unknown = [...new Set(Object.values(AREA_BY_PACKAGE))].filter((label) => !known.has(label));
    assert.deepEqual(unknown, [], `labels missing from labels.yml: ${unknown.join(", ")}`);
  });
});
