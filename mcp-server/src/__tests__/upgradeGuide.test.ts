import {describe, expect, test} from "bun:test";

import {getUpgradeGuideMarkdown} from "../upgradeGuide.js";

describe("getUpgradeGuideMarkdown", () => {
  test("returns bundled notes for a semver range when upgrade files exist", () => {
    const text = getUpgradeGuideMarkdown("0.19.0", "0.20.0");
    expect(text).toContain("0.20.0");
    expect(text).toMatch(/Upgrade to 0\.20\.0/i);
  });

  test("returns a single-version note when from and to match an existing file", () => {
    const text = getUpgradeGuideMarkdown("0.20.0", "0.20.0");
    expect(text).toContain("0.20.0");
  });

  test("returns guidance when no bundled notes match the requested range", () => {
    const text = getUpgradeGuideMarkdown("99.0.0", "99.1.0");
    expect(text).toContain("No upgrade notes found");
  });

  test("returns the 0.21.0 to 0.30.0 backfill note for that range", () => {
    const text = getUpgradeGuideMarkdown("0.21.0", "0.30.0");
    expect(text).toContain("Upgrade to 0.30.0");
    expect(text).toContain("OpenFeature");
    expect(text).toContain("flagConfiguration");
    expect(text).toContain("disableSearch");
    expect(text).toContain("APIError");
  });

  test("includes the 0.30.0 backfill when jumping 0.21.0 to current 57.2.0", () => {
    const text = getUpgradeGuideMarkdown("0.21.0", "57.2.0");
    expect(text).toContain("Upgrade to 0.30.0");
    expect(text).toContain("OpenFeature");
    expect(text).toContain("Upgrade to 57.2.0");
  });
});
