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
