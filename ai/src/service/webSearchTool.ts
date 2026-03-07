import type {Tool} from "ai";
import {jsonSchema, tool} from "ai";

export interface WebSearchResult {
  snippet: string;
  title: string;
  url: string;
}

export interface WebSearchProvider {
  search(query: string): Promise<WebSearchResult[]>;
}

export const createWebSearchTool = (provider: WebSearchProvider): Tool =>
  tool({
    description:
      "Search the web for current information. Use when the user asks about recent events, " +
      "needs facts you're unsure about, or asks you to look something up.",
    execute: async ({query}: {query: string}) => {
      const results = await provider.search(query);
      return {query, results: results.slice(0, 5)};
    },
    parameters: jsonSchema({
      properties: {
        query: {description: "Search query", type: "string"},
      },
      required: ["query"],
      type: "object",
    }),
  });
