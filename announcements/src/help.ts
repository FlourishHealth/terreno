import type {AnnouncementDocument, AnnouncementStatus} from "./types";

export interface AnnouncementHelpSummary {
  archivedAt?: string;
  excerpt: string;
  id: string;
  publishedAt?: string;
  status: AnnouncementStatus;
  title: string;
  version: number;
}

export interface AnnouncementHelpDetail {
  archivedAt?: string;
  body: string;
  expiresAt?: string;
  id: string;
  platforms: AnnouncementDocument["platforms"];
  primaryAction?: AnnouncementDocument["primaryAction"];
  priority: number;
  publishAt?: string;
  publishedAt?: string;
  requiresAcknowledgement: boolean;
  status: AnnouncementStatus;
  title: string;
  version: number;
}

export const buildHelpStatusFilter = (includeArchived: boolean): AnnouncementStatus[] => {
  if (includeArchived) {
    return ["published", "archived"];
  }
  return ["published"];
};

export const excerptBody = (body: string, maxLength = 240): string => {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
};

const matchesSingleQuery = (
  doc: Pick<AnnouncementDocument, "body" | "title">,
  query: string
): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const haystack = `${doc.title}\n${doc.body}`.toLowerCase();
  return haystack.includes(normalized);
};

export const matchesHelpQueries = (
  doc: Pick<AnnouncementDocument, "body" | "title">,
  queries: string[]
): boolean => {
  const activeQueries = queries.map((query) => query.trim()).filter(Boolean);
  if (activeQueries.length === 0) {
    return true;
  }
  return activeQueries.some((query) => matchesSingleQuery(doc, query));
};

export const toHelpSummary = (doc: AnnouncementDocument): AnnouncementHelpSummary => ({
  archivedAt: doc.archivedAt?.toISOString(),
  excerpt: excerptBody(doc.body),
  id: doc._id.toString(),
  publishedAt: doc.publishedAt?.toISOString(),
  status: doc.status,
  title: doc.title,
  version: doc.version,
});

export const toHelpDetail = (doc: AnnouncementDocument): AnnouncementHelpDetail => ({
  archivedAt: doc.archivedAt?.toISOString(),
  body: doc.body,
  expiresAt: doc.expiresAt?.toISOString(),
  id: doc._id.toString(),
  platforms: doc.platforms,
  primaryAction: doc.primaryAction,
  priority: doc.priority,
  publishAt: doc.publishAt?.toISOString(),
  publishedAt: doc.publishedAt?.toISOString(),
  requiresAcknowledgement: doc.requiresAcknowledgement,
  status: doc.status,
  title: doc.title,
  version: doc.version,
});
