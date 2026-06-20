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

  test("handles prerelease-style version tokens in semver keys", () => {
    const text = getUpgradeGuideMarkdown("0.19.0-rc.1", "0.20.0");
    expect(text.length).toBeGreaterThan(0);
  });
});
