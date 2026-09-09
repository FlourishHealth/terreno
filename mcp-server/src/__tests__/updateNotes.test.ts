import {afterEach, describe, expect, test} from "bun:test";
import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";

import {
  askUpdateHelp,
  getUpdateNote,
  resetBundledUpdateNoteIndex,
  searchUpdateNotes,
} from "../help/updateNotes.js";

describe("updateNotes help", () => {
  const previousDocsDir = process.env.TERRENO_MCP_DOCS_DIR;
  const tmpDir = join("/tmp", `terreno-mcp-help-${Date.now()}`);

  afterEach(() => {
    resetBundledUpdateNoteIndex();
    if (previousDocsDir) {
      process.env.TERRENO_MCP_DOCS_DIR = previousDocsDir;
    } else {
      delete process.env.TERRENO_MCP_DOCS_DIR;
    }
    delete process.env.TERRENO_HELP_API_URL;
    delete process.env.TERRENO_HELP_API_TOKEN;
  });

  test("searches bundled upgrade notes", async () => {
    mkdirSync(join(tmpDir, "upgrades"), {recursive: true});
    writeFileSync(
      join(tmpDir, "upgrades", "57.3.0.md"),
      "# Billing\n\nStripe webhook validation changed."
    );
    process.env.TERRENO_MCP_DOCS_DIR = tmpDir;
    resetBundledUpdateNoteIndex();

    const {hits, sources} = await searchUpdateNotes({
      queries: ["billing"],
      source: "bundled",
    });

    expect(sources).toContain("bundled-upgrades");
    expect(hits[0]?.id).toBe("upgrade:57.3.0");
    expect(hits[0]?.excerpt).toContain("Stripe webhook");
  });

  test("returns a bundled upgrade note in full", async () => {
    mkdirSync(join(tmpDir, "upgrades"), {recursive: true});
    const body = "Full upgrade body for syncdb.";
    writeFileSync(join(tmpDir, "upgrades", "57.2.0.md"), body);
    process.env.TERRENO_MCP_DOCS_DIR = tmpDir;
    resetBundledUpdateNoteIndex();

    const detail = await getUpdateNote({id: "upgrade:57.2.0"});
    expect(detail.kind).toBe("upgrade");
    expect(detail.body).toContain("Full upgrade body");
  });

  test("formats askUpdateHelp responses with match list", async () => {
    mkdirSync(join(tmpDir, "upgrades"), {recursive: true});
    writeFileSync(join(tmpDir, "upgrades", "57.1.0.md"), "Popover component added.");
    process.env.TERRENO_MCP_DOCS_DIR = tmpDir;
    resetBundledUpdateNoteIndex();

    const answer = await askUpdateHelp({question: "popover"});
    expect(answer).toContain("Top matches");
    expect(answer).toContain("upgrade:57.1.0");
  });

  test("reports when bundled docs directory is missing", async () => {
    process.env.TERRENO_MCP_DOCS_DIR = join(tmpDir, "missing-docs");
    resetBundledUpdateNoteIndex();
    expect(existsSync(join(tmpDir, "missing-docs", "upgrades"))).toBe(false);

    const {hits} = await searchUpdateNotes({queries: ["anything"], source: "bundled"});
    expect(hits).toEqual([]);
  });
});
