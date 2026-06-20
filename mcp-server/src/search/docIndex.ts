import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {extname, join, relative} from "node:path";
import MiniSearch from "minisearch";

import {getDocsRoot} from "../docsRoot.js";
import {
  formatComponentMarkdown,
  loadTypeDocJson,
  parseComponentsFromTypeDoc,
} from "../resources.js";
import {chunkMarkdown, type MarkdownChunk} from "./chunker.js";
import {inferPackageTags, normalizePackageFilter} from "./inferPackages.js";

export interface SearchableChunk extends MarkdownChunk {
  combined: string;
}

interface IndexedDoc {
  id: string;
  title: string;
  breadcrumb: string;
  text: string;
  combined: string;
  sourcePath: string;
  packageTagsJoined: string;
  packageTags: string[];
}

let cachedIndex: MiniSearch<IndexedDoc> | null = null;
let cachedChunks: SearchableChunk[] | null = null;

const walkMarkdownFiles = (dir: string, acc: string[] = []): string[] => {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkMarkdownFiles(full, acc);
    } else if (extname(name).toLowerCase() === ".md") {
      acc.push(full);
    }
  }
  return acc;
};

const loadAllChunks = (): SearchableChunk[] => {
  const root = getDocsRoot();
  const chunks: SearchableChunk[] = [];

  const resourcesDir = join(root, "resources");
  if (existsSync(resourcesDir)) {
    for (const file of readdirSync(resourcesDir)) {
      if (!file.endsWith(".md")) {
        continue;
      }
      const abs = join(resourcesDir, file);
      const rel = relative(root, abs).replace(/\\/g, "/");
      const tags = inferPackageTags(rel);
      const raw = readFileSync(abs, "utf-8");
      for (const c of chunkMarkdown(rel, raw, tags)) {
        chunks.push({...c, combined: `${c.breadcrumb} ${c.title} ${c.text}`});
      }
    }
  }

  const versionedDir = join(root, "versioned");
  if (existsSync(versionedDir)) {
    for (const abs of walkMarkdownFiles(versionedDir)) {
      const rel = relative(root, abs).replace(/\\/g, "/");
      const tags = inferPackageTags(rel);
      const raw = readFileSync(abs, "utf-8");
      for (const c of chunkMarkdown(rel, raw, tags)) {
        chunks.push({...c, combined: `${c.breadcrumb} ${c.title} ${c.text}`});
      }
    }
  }

  const typeDoc = loadTypeDocJson();
  if (typeDoc) {
    const components = parseComponentsFromTypeDoc(typeDoc);
    for (const comp of components) {
      const md = formatComponentMarkdown(comp);
      const rel = `resources/ui-types-component/${comp.name}.md`;
      const tags = ["ui"];
      for (const c of chunkMarkdown(rel, md, tags)) {
        chunks.push({...c, combined: `${c.breadcrumb} ${c.title} ${c.text}`});
      }
    }
  }

  const seenIds = new Set<string>();
  const deduped: SearchableChunk[] = [];
  for (const c of chunks) {
    if (seenIds.has(c.id)) {
      continue;
    }
    seenIds.add(c.id);
    deduped.push(c);
  }

  return deduped;
};

const buildMiniSearch = (chunks: SearchableChunk[]): MiniSearch<IndexedDoc> => {
  const docs: IndexedDoc[] = chunks.map((c) => ({
    breadcrumb: c.breadcrumb,
    combined: c.combined,
    id: c.id,
    packageTags: c.packageTags,
    packageTagsJoined: c.packageTags.join(" "),
    sourcePath: c.sourcePath,
    text: c.text,
    title: c.title,
  }));

  const search = new MiniSearch<IndexedDoc>({
    fields: ["title", "breadcrumb", "text", "combined", "sourcePath", "packageTagsJoined"],
    idField: "id",
    searchOptions: {
      boost: {breadcrumb: 1.8, combined: 1.2, title: 2.5},
      fuzzy: 0.18,
      prefix: true,
    },
    storeFields: ["title", "breadcrumb", "text", "sourcePath", "packageTags", "id"],
  });

  search.addAll(docs);
  return search;
};

export const resetDocSearchIndexForTests = (): void => {
  cachedIndex = null;
  cachedChunks = null;
};

const ensureIndex = (): {chunks: SearchableChunk[]; index: MiniSearch<IndexedDoc>} => {
  if (cachedIndex && cachedChunks) {
    return {chunks: cachedChunks, index: cachedIndex};
  }
  const chunks = loadAllChunks();
  cachedChunks = chunks;
  cachedIndex = buildMiniSearch(chunks);
  return {chunks: cachedChunks, index: cachedIndex};
};

export interface SearchDocsParams {
  queries: string[];
  packages?: string[];
  tokenLimit?: number;
}

const approxCharsForTokens = (tokens: number): number => {
  return Math.floor(Math.min(tokens, 8000) * 3.5);
};

const chunkMatchesPackages = (chunk: SearchableChunk, normalizedFilters: string[]): boolean => {
  if (normalizedFilters.length === 0) {
    return true;
  }
  return chunk.packageTags.some((t) => normalizedFilters.includes(t));
};

export const searchDocs = (params: SearchDocsParams): string => {
  const queries = params.queries.map((q) => q.trim()).filter(Boolean);
  if (queries.length === 0) {
    return 'No search queries provided. Pass one or more strings in `queries` (e.g. ["modelRouter", "Button props"]).';
  }

  const packageFilters = (params.packages ?? []).map(normalizePackageFilter).filter(Boolean);
  const charBudget = approxCharsForTokens(params.tokenLimit ?? 3000);

  const {chunks, index} = ensureIndex();
  const scoreById = new Map<string, number>();

  for (const q of queries) {
    const hits = index.search(q, {combineWith: "OR"});
    for (const hit of hits) {
      const prev = scoreById.get(hit.id) ?? 0;
      scoreById.set(hit.id, prev + hit.score);
    }
  }

  const rankedIds = [...scoreById.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const chunkById = new Map<string, SearchableChunk>();
  for (const c of chunks) {
    chunkById.set(c.id, c);
  }

  const lines: string[] = [
    "# Terreno documentation search results",
    "",
    `Queries: ${queries.map((q) => JSON.stringify(q)).join(", ")}`,
    packageFilters.length
      ? `Package filter: ${packageFilters.join(", ")}`
      : "Package filter: (none — all packages)",
    "",
  ];

  let used = 0;
  let included = 0;
  for (const id of rankedIds) {
    const chunk = chunkById.get(id);
    if (!chunk) {
      continue;
    }
    if (!chunkMatchesPackages(chunk, packageFilters)) {
      continue;
    }
    const rawBlock = [
      `## ${chunk.title}`,
      `_Source: \`${chunk.sourcePath}\` · Packages: ${chunk.packageTags.join(", ")}_`,
      "",
      chunk.text,
      "",
    ].join("\n");

    let block = rawBlock;
    if (block.length > charBudget && included === 0) {
      block = `${rawBlock.slice(0, charBudget)}\n\n_…Truncated to approximate token budget (~${params.tokenLimit ?? 3000} tokens)._`;
    } else if (used + block.length > charBudget && included > 0) {
      lines.push(
        `_Additional matches omitted to stay within token budget (~${params.tokenLimit ?? 3000} tokens)._`
      );
      break;
    }

    lines.push(block);
    used += block.length;
    included += 1;
    if (used >= charBudget) {
      break;
    }
  }

  if (included === 0) {
    lines.push(
      "No matching chunks found. Try different keywords, remove the package filter, or use passive MCP resources for full bundled guides."
    );
  }

  lines.push("");
  lines.push(
    "Prefer calling `terreno_search_docs` before guessing Terreno APIs. For a single @terreno/ui component props table, use `terreno_get_component_docs`."
  );

  return lines.join("\n");
};

export const getComponentDocsMarkdown = (componentName: string): string => {
  const trimmed = componentName.trim();
  if (!trimmed) {
    return 'Pass `component` (e.g. "Button").';
  }

  const typeDoc = loadTypeDocJson();
  if (!typeDoc) {
    return "Component documentation is unavailable (ui-types-documentation.json not found). Run `bun run sync-ui-docs` in mcp-server before build.";
  }

  const components = parseComponentsFromTypeDoc(typeDoc);
  const exact = components.find((c) => c.name === trimmed);
  const ci = components.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const chosen = exact ?? ci;
  if (!chosen) {
    const names = components.map((c) => c.name).sort();
    const preview = names.slice(0, 40).join(", ");
    const more = names.length > 40 ? `, … (+${names.length - 40} more)` : "";
    return `No component named "${trimmed}". Examples: ${preview}${more}`;
  }

  let md = formatComponentMarkdown(chosen);

  const {chunks, index} = ensureIndex();
  const extra = index.search(`${chosen.name} props`, {combineWith: "OR", fuzzy: 0.2}).slice(0, 3);
  const chunkById = new Map<string, SearchableChunk>();
  for (const c of chunks) {
    chunkById.set(c.id, c);
  }
  const extras: string[] = [];
  for (const hit of extra) {
    const ch = chunkById.get(hit.id);
    if (!ch) {
      continue;
    }
    if (!ch.text.includes(chosen.name)) {
      continue;
    }
    extras.push(
      `### Related: ${ch.title}\n_Source: \`${ch.sourcePath}\`_\n\n${ch.text.slice(0, 1500)}`
    );
  }
  if (extras.length) {
    md += "\n\n## Related markdown excerpts\n\n";
    md += extras.join("\n\n---\n\n");
  }

  return md;
};
