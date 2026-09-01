import {describe, expect, test} from "bun:test";
import {existsSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {getUpgradeGuideMarkdown} from "../upgradeGuide.js";

const upgradesDir = join(dirname(fileURLToPath(import.meta.url)), "../docs/upgrades");
const formatReadmePath = join(upgradesDir, "README.md");

const REQUIRED_SECTIONS = [
  "Action required",
  "Affected packages",
  "Summary",
  "Breaking changes",
  "What changed",
  "Why",
  "Migration",
  "Deprecations",
  "New capabilities",
  "Verification",
] as const;

describe("upgrade note format README", () => {
  test("documents the required note format with a copy-paste template", () => {
    expect(existsSync(formatReadmePath)).toBe(true);
    const text = readFileSync(formatReadmePath, "utf-8");
    for (const section of REQUIRED_SECTIONS) {
      expect(text).toContain(section);
    }
    expect(text).toContain("terreno_get_upgrade_guide");
    expect(text).toContain("self-contained");
    expect(text).toMatch(/```markdown[\s\S]*# Upgrading to /);
  });

  test("is not concatenated as an upgrade version by terreno_get_upgrade_guide", () => {
    const byName = getUpgradeGuideMarkdown("README", "README");
    expect(byName).toContain("Invalid version range");
    expect(byName).not.toContain("copy-paste template");
    const wideRange = getUpgradeGuideMarkdown("0.19.0", "99.0.0");
    expect(wideRange).not.toContain("Upgrade to README");
    expect(wideRange).not.toMatch(/^# Upgrade to README/m);
  });
});
