import {afterEach, beforeEach, describe, expect, test} from "bun:test";
import {mkdirSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";

import {chunkMarkdown} from "../search/chunker.js";
import {
  getComponentDocsMarkdown,
  resetDocSearchIndexForTests,
  searchDocs,
} from "../search/docIndex.js";

describe("chunkMarkdown", () => {
  test("splits on headings and builds breadcrumbs", () => {
    const md = `# Title\n\nIntro\n\n## Sub\n\nBody here`;
    const chunks = chunkMarkdown("test.md", md, ["docs"]);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const sub = chunks.find((c) => c.title === "Sub");
    expect(sub).toBeDefined();
    expect(sub?.breadcrumb).toContain("Title");
    expect(sub?.text).toContain("Body here");
  });
});

describe("docIndex", () => {
  const tmp = join(import.meta.dir, "tmp-doc-search");

  beforeEach(() => {
    resetDocSearchIndexForTests();
    rmSync(tmp, {force: true, recursive: true});
    mkdirSync(join(tmp, "resources"), {recursive: true});
    process.env.TERRENO_MCP_DOCS_DIR = tmp;
  });

  afterEach(() => {
    delete process.env.TERRENO_MCP_DOCS_DIR;
    resetDocSearchIndexForTests();
    rmSync(tmp, {force: true, recursive: true});
  });

  test("finds keyword in indexed markdown", () => {
    writeFileSync(
      join(tmp, "resources", "api.md"),
      ["# Terreno API", "", "## modelRouter", "", "The modelRouter helper maps CRUD routes."].join(
        "\n"
      )
    );

    const out = searchDocs({queries: ["modelRouter"]});
    expect(out).toContain("modelRouter");
    expect(out).toContain("Terreno documentation search results");
  });

  test("package filter excludes non-matching chunks", () => {
    writeFileSync(
      join(tmp, "resources", "api.md"),
      ["# API", "", "alpha unique token xyz123"].join("\n")
    );
    writeFileSync(
      join(tmp, "resources", "ui.md"),
      ["# UI", "", "beta unique token abc789"].join("\n")
    );

    const uiOnly = searchDocs({packages: ["ui"], queries: ["abc789"]});
    expect(uiOnly).toContain("abc789");
    expect(uiOnly).not.toContain("xyz123");

    const apiOnly = searchDocs({packages: ["@terreno/api"], queries: ["xyz123"]});
    expect(apiOnly).toContain("xyz123");
    expect(apiOnly).not.toContain("abc789");
  });

  test("tokenLimit truncates oversized single result", () => {
    writeFileSync(
      join(tmp, "resources", "patterns.md"),
      ["# Patterns", "", "## Big section", "", `Section keyword filler ${"x".repeat(800)}`].join(
        "\n\n"
      )
    );

    const small = searchDocs({queries: ["Section"], tokenLimit: 5});
    expect(small).toContain("Truncated to approximate token budget");
  });

  test("getComponentDocsMarkdown returns not-found message without typedoc", () => {
    const msg = getComponentDocsMarkdown("Button");
    expect(msg).toContain("unavailable");
  });
});
