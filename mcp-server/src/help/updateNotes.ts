import {existsSync, readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import MiniSearch from "minisearch";

import {getDocsRoot} from "../docsRoot.js";
import {getUpgradeGuideMarkdown} from "../upgradeGuide.js";
import {excerptBody} from "./excerpt.js";

export interface UpdateNoteSearchHit {
  archivedAt?: string;
  excerpt: string;
  id: string;
  kind: "announcement" | "upgrade";
  publishedAt?: string;
  status?: string;
  title: string;
  version?: string;
}

export interface UpdateNoteDetail {
  archivedAt?: string;
  body: string;
  expiresAt?: string;
  id: string;
  kind: "announcement" | "upgrade";
  platforms?: string[];
  publishedAt?: string;
  status?: string;
  title: string;
  version?: string;
}

interface BundledUpgradeDoc {
  body: string;
  id: string;
  title: string;
  version: string;
}

interface HelpApiConfig {
  apiToken?: string;
  apiUrl: string;
}

const UPGRADE_ID_PREFIX = "upgrade:";
const ANNOUNCEMENT_ID_PREFIX = "announcement:";

interface BundledUpgradeCache {
  docs: BundledUpgradeDoc[];
  docsRoot: string;
  index: MiniSearch<BundledUpgradeDoc>;
}

let bundledUpgradeCache: BundledUpgradeCache | null = null;

const normalizeApiBase = (apiUrl: string): string => apiUrl.replace(/\/$/, "");

const getHelpApiConfig = (): HelpApiConfig | null => {
  const apiUrl = process.env.TERRENO_HELP_API_URL?.trim();
  if (!apiUrl) {
    return null;
  }
  const apiToken = process.env.TERRENO_HELP_API_TOKEN?.trim();
  return {apiToken, apiUrl: normalizeApiBase(apiUrl)};
};

const listBundledUpgradeVersions = (): string[] => {
  const dir = join(getDocsRoot(), "upgrades");
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((file) => /^\d.*\.md$/i.test(file))
    .map((file) => file.replace(/\.md$/i, ""))
    .sort();
};

const getBundledUpgradeCache = (): BundledUpgradeCache => {
  const docsRoot = getDocsRoot();
  if (bundledUpgradeCache && bundledUpgradeCache.docsRoot === docsRoot) {
    return bundledUpgradeCache;
  }

  const versions = listBundledUpgradeVersions();
  const docs = versions.map((version) => {
    const body = readFileSync(join(docsRoot, "upgrades", `${version}.md`), "utf-8");
    return {
      body,
      id: `${UPGRADE_ID_PREFIX}${version}`,
      title: `Terreno ${version} upgrade notes`,
      version,
    };
  });
  const index = new MiniSearch<BundledUpgradeDoc>({
    fields: ["title", "body", "version"],
    searchOptions: {
      boost: {title: 3, version: 2},
      prefix: true,
    },
    storeFields: ["id", "title", "version", "body"],
  });
  index.addAll(docs);
  bundledUpgradeCache = {docs, docsRoot, index};
  return bundledUpgradeCache;
};

const loadBundledUpgradeDocs = (): BundledUpgradeDoc[] => getBundledUpgradeCache().docs;

const getBundledIndex = (): MiniSearch<BundledUpgradeDoc> => getBundledUpgradeCache().index;

const parseQueries = (queries: string[], question?: string): string[] => {
  const merged = [...queries];
  if (question?.trim()) {
    merged.push(question.trim());
  }
  return merged.map((query) => query.trim()).filter(Boolean);
};

const searchBundledUpgrades = (queries: string[], limit: number): UpdateNoteSearchHit[] => {
  const activeQueries = parseQueries(queries);
  if (activeQueries.length === 0) {
    return loadBundledUpgradeDocs()
      .slice(-limit)
      .reverse()
      .map((doc) => ({
        excerpt: excerptBody(doc.body),
        id: doc.id,
        kind: "upgrade",
        title: doc.title,
        version: doc.version,
      }));
  }

  const index = getBundledIndex();
  const combinedQuery = activeQueries.join(" ");
  const results = index.search(combinedQuery, {combineWith: "OR", fuzzy: 0.1});
  return results.slice(0, limit).map((result) => ({
    excerpt: excerptBody(String(result.body ?? "")),
    id: String(result.id),
    kind: "upgrade",
    title: String(result.title),
    version: String(result.version),
  }));
};

const apiFetch = async <T>(config: HelpApiConfig, path: string): Promise<T> => {
  const headers: Record<string, string> = {Accept: "application/json"};
  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }
  const response = await fetch(`${config.apiUrl}${path}`, {headers});
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Help API ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
};

const searchApiAnnouncements = async ({
  config,
  includeArchived,
  limit,
  queries,
}: {
  config: HelpApiConfig;
  includeArchived: boolean;
  limit: number;
  queries: string[];
}): Promise<UpdateNoteSearchHit[]> => {
  const activeQueries = parseQueries(queries);
  const queryString =
    activeQueries.length > 0 ? `&q=${encodeURIComponent(activeQueries.join(" "))}` : "";
  const archivedFlag = includeArchived ? "&includeArchived=true" : "";
  const response = await apiFetch<{data: Array<Record<string, unknown>>}>(
    config,
    `/announcements/help/search?limit=${limit}${archivedFlag}${queryString}`
  );
  return response.data.map((row) => ({
    archivedAt: typeof row.archivedAt === "string" ? row.archivedAt : undefined,
    excerpt: typeof row.excerpt === "string" ? row.excerpt : "",
    id: `${ANNOUNCEMENT_ID_PREFIX}${String(row.id)}`,
    kind: "announcement",
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    title: typeof row.title === "string" ? row.title : "Announcement",
    version: typeof row.version === "number" ? String(row.version) : undefined,
  }));
};

const getApiAnnouncement = async ({
  config,
  id,
  includeArchived,
}: {
  config: HelpApiConfig;
  id: string;
  includeArchived: boolean;
}): Promise<UpdateNoteDetail> => {
  const archivedFlag = includeArchived ? "?includeArchived=true" : "";
  const response = await apiFetch<{data: Record<string, unknown>}>(
    config,
    `/announcements/help/${encodeURIComponent(id)}${archivedFlag}`
  );
  const row = response.data;
  return {
    archivedAt: typeof row.archivedAt === "string" ? row.archivedAt : undefined,
    body: typeof row.body === "string" ? row.body : "",
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : undefined,
    id: `${ANNOUNCEMENT_ID_PREFIX}${String(row.id)}`,
    kind: "announcement",
    platforms: Array.isArray(row.platforms)
      ? row.platforms.filter((value): value is string => typeof value === "string")
      : undefined,
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    title: typeof row.title === "string" ? row.title : "Announcement",
    version: typeof row.version === "number" ? String(row.version) : undefined,
  };
};

const parseUpdateNoteId = (
  rawId: string
): {announcementId?: string; kind: "announcement" | "upgrade"; upgradeVersion?: string} => {
  const trimmed = rawId.trim();
  if (trimmed.startsWith(ANNOUNCEMENT_ID_PREFIX)) {
    return {announcementId: trimmed.slice(ANNOUNCEMENT_ID_PREFIX.length), kind: "announcement"};
  }
  if (trimmed.startsWith(UPGRADE_ID_PREFIX)) {
    return {kind: "upgrade", upgradeVersion: trimmed.slice(UPGRADE_ID_PREFIX.length)};
  }
  if (/^\d+\.\d+\.\d+/.test(trimmed)) {
    return {kind: "upgrade", upgradeVersion: trimmed};
  }
  return {announcementId: trimmed, kind: "announcement"};
};

export const searchUpdateNotes = async ({
  includeArchived = false,
  limit = 10,
  queries = [],
  question,
  source = "auto",
}: {
  includeArchived?: boolean;
  limit?: number;
  queries?: string[];
  question?: string;
  source?: "announcement" | "auto" | "bundled";
}): Promise<{hits: UpdateNoteSearchHit[]; sources: string[]}> => {
  const config = getHelpApiConfig();
  const hits: UpdateNoteSearchHit[] = [];
  const sources: string[] = [];
  const activeQueries = parseQueries(queries, question);
  const perSourceLimit = Math.max(limit, 1);

  const shouldSearchBundled = source === "bundled" || source === "auto";
  const shouldSearchAnnouncements =
    source === "announcement" || (source === "auto" && config !== null);

  if (shouldSearchBundled) {
    hits.push(...searchBundledUpgrades(activeQueries, perSourceLimit));
    sources.push("bundled-upgrades");
  }

  if (shouldSearchAnnouncements && config) {
    try {
      hits.push(
        ...(await searchApiAnnouncements({
          config,
          includeArchived,
          limit: perSourceLimit,
          queries: activeQueries,
        }))
      );
      sources.push("announcements-api");
    } catch (error) {
      sources.push(`announcements-api-error:${(error as Error).message}`);
    }
  }

  return {hits: hits.slice(0, perSourceLimit), sources};
};

export const getUpdateNote = async ({
  id,
  includeArchived = false,
}: {
  id: string;
  includeArchived?: boolean;
}): Promise<UpdateNoteDetail> => {
  const parsed = parseUpdateNoteId(id);
  if (parsed.kind === "upgrade" && parsed.upgradeVersion) {
    const body = getUpgradeGuideMarkdown(parsed.upgradeVersion, parsed.upgradeVersion);
    return {
      body,
      id: `${UPGRADE_ID_PREFIX}${parsed.upgradeVersion}`,
      kind: "upgrade",
      title: `Terreno ${parsed.upgradeVersion} upgrade notes`,
      version: parsed.upgradeVersion,
    };
  }

  const config = getHelpApiConfig();
  if (!config || !parsed.announcementId) {
    throw new Error(
      "Announcement update notes require TERRENO_HELP_API_URL (and optional TERRENO_HELP_API_TOKEN)."
    );
  }

  return getApiAnnouncement({config, id: parsed.announcementId, includeArchived});
};

export const askUpdateHelp = async ({
  includeArchived = false,
  limit = 5,
  question,
}: {
  includeArchived?: boolean;
  limit?: number;
  question: string;
}): Promise<string> => {
  const trimmed = question.trim();
  if (!trimmed) {
    return "Provide a non-empty `question` string.";
  }

  const {hits, sources} = await searchUpdateNotes({
    includeArchived,
    limit,
    question: trimmed,
  });

  if (hits.length === 0) {
    return [
      `No update notes matched: "${trimmed}"`,
      `Sources searched: ${sources.join(", ") || "none"}`,
      "Try broader keywords or call terreno_get_update_note with a specific id.",
    ].join("\n");
  }

  const lines = [
    `Question: ${trimmed}`,
    `Sources: ${sources.join(", ")}`,
    "",
    "Top matches (call terreno_get_update_note with `id` for the full note):",
  ];

  for (const hit of hits) {
    lines.push(
      `- [${hit.kind}] ${hit.title} (${hit.id})${hit.status ? ` — ${hit.status}` : ""}`,
      `  ${hit.excerpt}`
    );
  }

  return lines.join("\n");
};
