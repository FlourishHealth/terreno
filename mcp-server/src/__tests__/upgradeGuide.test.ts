import {afterEach, describe, expect, test} from "bun:test";
import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";

import {askUpdateHelp, getUpdateNote, searchUpdateNotes} from "../help/updateNotes.js";
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

  test("range fully covered lists recorded notes and concatenates them", () => {
    const text = getUpgradeGuideMarkdown("0.19.0", "0.20.0");
    expect(text).toContain("Recorded notes in 0.19.0 → 0.20.0: 0.20.0");
    expect(text).toMatch(/Upgrade to 0\.20\.0/i);
    expect(text).not.toContain("No bundled notes for");
  });

  test("range partially covered lists recorded notes and names missing minors", () => {
    const text = getUpgradeGuideMarkdown("0.21.0", "0.31.0");
    expect(text).toContain("Recorded notes in 0.21.0 → 0.31.0: 0.30.0, 0.31.0");
    expect(text).toContain(
      "No bundled notes for 0.22.0, 0.23.0, 0.24.0, 0.25.0, 0.26.0, 0.27.0, 0.28.0, 0.29.0"
    );
    expect(text).toContain("Upgrade to 0.30.0");
    expect(text).toContain("Upgrade to 0.31.0");
  });

  test("range with no notes names the versions and warns against assuming no changes", () => {
    const text = getUpgradeGuideMarkdown("99.0.0", "99.1.0");
    expect(text).toContain("No upgrade notes recorded for 99.0.0 → 99.1.0");
    expect(text).toContain("No bundled notes for 99.1.0");
    expect(text).toContain("Recorded notes in 99.0.0 → 99.1.0: none");
    expect(text).toContain("Do not conclude that nothing changed");
  });

  test("invalid range is rejected when fromVersion is after toVersion", () => {
    const text = getUpgradeGuideMarkdown("0.21.0", "0.20.0");
    expect(text).toContain("Invalid version range");
    expect(text).toContain("0.21.0");
    expect(text).toContain("0.20.0");
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

describe("updateNotes help", () => {
  const previousDocsDir = process.env.TERRENO_MCP_DOCS_DIR;

  afterEach(() => {
    if (previousDocsDir) {
      process.env.TERRENO_MCP_DOCS_DIR = previousDocsDir;
    } else {
      delete process.env.TERRENO_MCP_DOCS_DIR;
    }
    delete process.env.TERRENO_HELP_API_URL;
    delete process.env.TERRENO_HELP_API_TOKEN;
  });

  test("searches bundled upgrade notes", async () => {
    const tmpDir = join("/tmp", `terreno-mcp-help-search-${Date.now()}`);
    mkdirSync(join(tmpDir, "upgrades"), {recursive: true});
    writeFileSync(
      join(tmpDir, "upgrades", "57.3.0.md"),
      "# Billing\n\nStripe webhook validation changed."
    );
    process.env.TERRENO_MCP_DOCS_DIR = tmpDir;

    const {hits, sources} = await searchUpdateNotes({
      queries: ["billing"],
      source: "bundled",
    });

    expect(sources).toContain("bundled-upgrades");
    expect(hits[0]?.id).toBe("upgrade:57.3.0");
    expect(hits[0]?.excerpt).toContain("Stripe webhook");
  });

  test("returns a bundled upgrade note in full", async () => {
    const tmpDir = join("/tmp", `terreno-mcp-help-detail-${Date.now()}`);
    mkdirSync(join(tmpDir, "upgrades"), {recursive: true});
    const body = "Full upgrade body for syncdb.";
    writeFileSync(join(tmpDir, "upgrades", "57.2.0.md"), body);
    process.env.TERRENO_MCP_DOCS_DIR = tmpDir;

    const detail = await getUpdateNote({id: "upgrade:57.2.0"});
    expect(detail.kind).toBe("upgrade");
    expect(detail.body).toContain("Full upgrade body");
  });

  test("formats askUpdateHelp responses with match list", async () => {
    const tmpDir = join("/tmp", `terreno-mcp-help-ask-${Date.now()}`);
    mkdirSync(join(tmpDir, "upgrades"), {recursive: true});
    writeFileSync(join(tmpDir, "upgrades", "57.1.0.md"), "Popover component added.");
    process.env.TERRENO_MCP_DOCS_DIR = tmpDir;

    const answer = await askUpdateHelp({question: "popover"});
    expect(answer).toContain("Top matches");
    expect(answer).toContain("upgrade:57.1.0");
  });

  test("reports when bundled docs directory is missing", async () => {
    const tmpDir = join("/tmp", `terreno-mcp-help-missing-${Date.now()}`);
    process.env.TERRENO_MCP_DOCS_DIR = join(tmpDir, "missing-docs");
    expect(existsSync(join(tmpDir, "missing-docs", "upgrades"))).toBe(false);

    const {hits} = await searchUpdateNotes({queries: ["anything"], source: "bundled"});
    expect(hits).toEqual([]);
  });
});
