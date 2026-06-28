import {afterEach, beforeEach, describe, expect, test} from "bun:test";
import {mkdirSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {join} from "node:path";

import {chunkMarkdown, standaloneDocumentChunk} from "../search/chunker.js";
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

  test("pops heading stack when encountering a same-level sibling heading", () => {
    const md = ["# Section", "## A", "## B", "", "Under B"].join("\n");
    const chunks = chunkMarkdown("sibling.md", md, ["docs"]);
    const b = chunks.find((c) => c.title === "B");
    expect(b).toBeDefined();
    expect(b?.breadcrumb).toContain("Section");
    expect(b?.text).toContain("Under B");
  });

  test("handles CRLF line endings", () => {
    const md = "# One\r\n\r\nBody\r\n## Two\r\nMore";
    const chunks = chunkMarkdown("crlf.md", md, ["docs"]);
    expect(chunks.some((c) => c.title === "Two")).toBe(true);
  });

  test("returns a single intro chunk for body text without headings", () => {
    const chunks = chunkMarkdown("plain.md", "Only paragraph text.", ["docs"]);
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.title).toBe("(intro)");
  });

  test("returns no chunks for whitespace-only markdown", () => {
    expect(chunkMarkdown("empty.md", "\n\n\n", ["docs"])).toEqual([]);
  });

  test("standaloneDocumentChunk matches fallback shape used by chunkMarkdown", () => {
    const chunk = standaloneDocumentChunk("only.md", "  hello  ", ["docs"]);
    expect(chunk.title).toBe("(document)");
    expect(chunk.text).toBe("hello");
    expect(chunk.breadcrumb).toBe("only.md");
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

  test("invalid or non-positive tokenLimit matches default budget behavior", () => {
    writeFileSync(
      join(tmp, "resources", "api.md"),
      ["# API", "", "alpha unique token xyz123"].join("\n")
    );
    const baseline = searchDocs({queries: ["alpha"]});
    expect(searchDocs({queries: ["alpha"], tokenLimit: -1})).toBe(baseline);
    expect(searchDocs({queries: ["alpha"], tokenLimit: Number.NaN})).toBe(baseline);
    expect(searchDocs({queries: ["alpha"], tokenLimit: 0})).toBe(baseline);
  });

  test("does not index markdown reached only via symlink under versioned/", () => {
    const outsideDir = join(tmp, "outside-leak");
    mkdirSync(outsideDir, {recursive: true});
    const secretToken = "symlinkLeakTokenOutsideTree998877";
    writeFileSync(join(outsideDir, "secret.md"), ["# Secret", "", secretToken].join("\n"));
    const versionedNested = join(tmp, "versioned", "0.1", "nested");
    mkdirSync(versionedNested, {recursive: true});
    try {
      symlinkSync(join(outsideDir, "secret.md"), join(versionedNested, "alias.md"));
    } catch {
      return;
    }
    const out = searchDocs({queries: [secretToken]});
    expect(out).toContain("No matching chunks found");
  });

  test("getComponentDocsMarkdown returns not-found message without typedoc", () => {
    const msg = getComponentDocsMarkdown("Button");
    expect(msg).toContain("unavailable");
  });

  test("searchDocs returns guidance when queries are empty or whitespace-only", () => {
    expect(searchDocs({queries: []})).toContain("No search queries provided");
    expect(searchDocs({queries: ["", "  "]})).toContain("No search queries provided");
  });

  test("searchDocs reports no matches for nonsense query", () => {
    writeFileSync(join(tmp, "resources", "api.md"), ["# API", "", "Some content here."].join("\n"));
    const out = searchDocs({queries: ["zzzznonexistenttoken99999"]});
    expect(out).toContain("No matching chunks found");
  });

  test("searchDocs omits additional matches when token budget is exhausted", () => {
    writeFileSync(
      join(tmp, "resources", "one.md"),
      ["# One", "", "sharedkeyword onebody short."].join("\n")
    );
    writeFileSync(
      join(tmp, "resources", "two.md"),
      ["# Two", "", "sharedkeyword twobody short."].join("\n")
    );
    const out = searchDocs({queries: ["sharedkeyword"], tokenLimit: 45});
    expect(out).toContain("sharedkeyword");
    expect(out).toContain("Additional matches omitted");
  });

  test("indexes nested versioned markdown files", () => {
    const vDir = join(tmp, "versioned", "0.19.0", "nested");
    mkdirSync(vDir, {recursive: true});
    writeFileSync(
      join(vDir, "guide.md"),
      ["# Guide", "", "versionedUniqueToken7654321"].join("\n")
    );
    const out = searchDocs({queries: ["versionedUniqueToken7654321"]});
    expect(out).toContain("versionedUniqueToken7654321");
    expect(out).toContain("nested/guide.md");
  });

  test("getComponentDocsMarkdown resolves component case-insensitively and adds related excerpts", () => {
    const typeDoc = {
      children: [
        {
          children: [
            {
              children: [
                {
                  flags: {},
                  name: "label",
                  type: {name: "string", type: "intrinsic"},
                },
              ],
              kind: 256,
              name: "ButtonProps",
            },
          ],
          name: "Common",
        },
      ],
    };
    writeFileSync(join(tmp, "ui-types-documentation.json"), JSON.stringify(typeDoc));
    writeFileSync(
      join(tmp, "resources", "extra.md"),
      ["# UI patterns", "", "Extra notes about Button props for search."].join("\n")
    );

    const lower = getComponentDocsMarkdown("button");
    expect(lower).toContain("# Button");
    expect(lower).toContain("Related markdown excerpts");

    const unknown = getComponentDocsMarkdown("NotARealComponent999");
    expect(unknown).toContain('No component named "NotARealComponent999"');
    expect(unknown).toContain("Examples:");
  });

  test("getComponentDocsMarkdown asks for component when name is blank", () => {
    expect(getComponentDocsMarkdown("   ")).toContain("Pass `component`");
  });
});
