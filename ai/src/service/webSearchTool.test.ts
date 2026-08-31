import {describe, expect, it} from "bun:test";

import type {WebSearchProvider, WebSearchResult} from "./webSearchTool";

describe("webSearchTool types", () => {
  it("defines WebSearchResult with snippet, title, and url", () => {
    const result: WebSearchResult = {
      snippet: "An example snippet describing the page.",
      title: "Example Title",
      url: "https://example.com",
    };

    expect(result.title).toBe("Example Title");
    expect(result.url).toBe("https://example.com");
    expect(result.snippet).toContain("snippet");
  });

  it("allows implementing WebSearchProvider and returning results", async () => {
    const provider: WebSearchProvider = {
      async search(query: string): Promise<WebSearchResult[]> {
        return [
          {
            snippet: `Result for ${query}`,
            title: `Title for ${query}`,
            url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          },
        ];
      },
    };

    const results = await provider.search("terreno");
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Title for terreno");
    expect(results[0]?.url).toContain("q=terreno");
  });

  it("supports providers that return no results", async () => {
    const emptyProvider: WebSearchProvider = {
      async search(): Promise<WebSearchResult[]> {
        return [];
      },
    };

    await expect(emptyProvider.search("nothing")).resolves.toEqual([]);
  });
});
