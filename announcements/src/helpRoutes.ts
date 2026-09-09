import {APIError, asyncHandler, authenticateMiddleware} from "@terreno/api";
import {type Request, type Response, Router} from "express";
import {buildHelpStatusFilter, matchesHelpQueries, toHelpDetail, toHelpSummary} from "./help";
import {Announcement} from "./models/announcement";
import type {AnnouncementDocument} from "./types";

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
}: {
  app: import("express").Application;
  basePath: string;
}): void => {
  const router = Router();

  router.get(
    "/help/search",
    authenticateMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const queries = parseHelpQueries(req);
      const includeArchived = parseIncludeArchived(req);
      const limit = parseLimit(req);
      const statuses = buildHelpStatusFilter(includeArchived);

      const candidates = await Announcement.find({status: {$in: statuses}});
      const matched = sortHelpResults(candidates.filter((doc) => matchesHelpQueries(doc, queries)));
      const page = matched.slice(0, limit).map(toHelpSummary);

      return res.json({data: page, total: matched.length});
    })
  );

  router.get(
    "/help/:id",
    authenticateMiddleware(),
    asyncHandler(async (req: Request, res: Response) => {
      const includeArchived = parseIncludeArchived(req);
      const statuses = buildHelpStatusFilter(includeArchived);
      const announcement = await Announcement.findById(req.params.id);
      if (!announcement || !statuses.includes(announcement.status)) {
        throw new APIError({status: 404, title: "Update note not found"});
      }
      return res.json({data: toHelpDetail(announcement)});
    })
  );

  app.use(basePath, router);
};
