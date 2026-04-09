export interface WebSearchResult {
  snippet: string;
  title: string;
  url: string;
}

/**
 * Interface for pluggable web search providers.
 *
 * Implement this to integrate any search API (Tavily, Brave, Google Custom Search, etc.)
 * with the AI chat tool system.
 *
 * @example
 * ```typescript
 * import {tool, zodSchema} from "ai";
 * import {z} from "zod";
 * import type {WebSearchProvider} from "@terreno/ai";
 *
 * const myProvider: WebSearchProvider = {
 *   search: async (query) => {
 *     const res = await fetch(`https://api.tavily.com/search`, { ... });
 *     return res.json().results;
 *   },
 * };
 *
 * const webSearchTool = tool({
 *   description: "Search the web for current information.",
 *   execute: async ({query}) => {
 *     const results = await myProvider.search(query);
 *     return {query, results: results.slice(0, 5)};
 *   },
 *   inputSchema: zodSchema(z.object({
 *     query: z.string().describe("Search query"),
 *   })),
 * });
 * ```
 */
export interface WebSearchProvider {
  search(query: string): Promise<WebSearchResult[]>;
}
