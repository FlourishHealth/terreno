import {APIError, asyncHandler, authenticateMiddleware} from "@terreno/api";
import {type Request, type Response, Router} from "express";
import {buildHelpStatusFilter, matchesHelpQueries, toHelpDetail, toHelpSummary} from "./help";
import {Announcement} from "./models/announcement";
import {isAnnouncementVisibleNow} from "./pending";
import type {AnnouncementDocument, MatchAudienceFunction} from "./types";

const parseHelpQueries = (req: Request): string[] => {
  const raw = req.query.q;
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  if (Array.isArray(raw)) {
    return raw.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
  }
  return [];
};

const parseIncludeArchived = (req: Request): boolean => {
  const raw = req.query.includeArchived;
  if (raw === "true" || raw === "1") {
    return true;
  }
  return false;
};

const parseLimit = (req: Request): number => {
  const parsed = Number(req.query.limit ?? 10);
  return Math.min(Math.max(parsed, 1), 50);
};

const isAnnouncementHelpVisible = (announcement: AnnouncementDocument): boolean => {
  if (announcement.status === "archived") {
    return true;
  }
  return isAnnouncementVisibleNow({announcement});
};

const sortHelpResults = (docs: AnnouncementDocument[]): AnnouncementDocument[] => {
  return [...docs].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    const rightPublished = right.publishedAt?.getTime() ?? 0;
    const leftPublished = left.publishedAt?.getTime() ?? 0;
    return rightPublished - leftPublished;
  });
};

export const registerAnnouncementHelpRoutes = ({
  app,
  basePath,
  matchAudience,
}: {
  app: import("express").Application;
  basePath: string;
  matchAudience?: MatchAudienceFunction;
}): void => {
  const audienceMatcher = matchAudience ?? (() => true);
  const router = Router();

  router.get(
    "/help/search",
    authenticateMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user;
      if (!user) {
        throw new APIError({status: 401, title: "Authentication required"});
      }

      const queries = parseHelpQueries(req);
      const includeArchived = parseIncludeArchived(req);
      const limit = parseLimit(req);
      const statuses = buildHelpStatusFilter(includeArchived);

      const candidates = await Announcement.find({status: {$in: statuses}});
      const matched: AnnouncementDocument[] = [];
      for (const doc of candidates) {
        if (!isAnnouncementHelpVisible(doc)) {
          continue;
        }
        const matchesAudience = await audienceMatcher(user, doc);
        if (!matchesAudience) {
          continue;
        }
        if (!matchesHelpQueries(doc, queries)) {
          continue;
        }
        matched.push(doc);
      }

      const page = sortHelpResults(matched).slice(0, limit).map(toHelpSummary);

      return res.json({data: page, total: matched.length});
    })
  );

  router.get(
    "/help/:id",
    authenticateMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user;
      if (!user) {
        throw new APIError({status: 401, title: "Authentication required"});
      }

      const includeArchived = parseIncludeArchived(req);
      const statuses = buildHelpStatusFilter(includeArchived);
      const announcement = await Announcement.findById(req.params.id);
      if (!announcement || !statuses.includes(announcement.status)) {
        throw new APIError({status: 404, title: "Update note not found"});
      }
      if (!isAnnouncementHelpVisible(announcement)) {
        throw new APIError({status: 404, title: "Update note not found"});
      }
      const matchesAudience = await audienceMatcher(user, announcement);
      if (!matchesAudience) {
        throw new APIError({status: 404, title: "Update note not found"});
      }
      return res.json({data: toHelpDetail(announcement)});
    })
  );

  app.use(basePath, router);
};
