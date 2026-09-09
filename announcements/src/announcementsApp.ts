import {
  type AdminContribution,
  APIError,
  asyncHandler,
  authenticateMiddleware,
  logger,
  type ModelRouterOptions,
  modelRouter,
  type OpenApiMiddleware,
  Permissions,
  type TerrenoPlugin,
} from "@terreno/api";
import {type Application, type Request, type Response, Router} from "express";
import {DateTime} from "luxon";
import type {Model} from "mongoose";
import {registerAnnouncementHelpRoutes} from "./helpRoutes";
import {Announcement, toAnnouncementPublic} from "./models/announcement";
import {AnnouncementAcknowledgement} from "./models/announcementAcknowledgement";
import {AnnouncementImpression, isValidPlatform} from "./models/announcementImpression";
import {isAnnouncementVisibleNow, matchesPlatform, selectPendingAnnouncements} from "./pending";
import type {
  AcknowledgementMode,
  AnnouncementDocument,
  AnnouncementPlatform,
  AnnouncementsOptions,
} from "./types";

const DEFAULT_BASE_PATH = "/announcements";

const parsePlatform = (req: Request): AnnouncementPlatform => {
  const queryPlatform = req.query.platform;
  if (isValidPlatform(queryPlatform)) {
    return queryPlatform;
  }

  const userAgent = req.get("user-agent")?.toLowerCase() ?? "";
  if (userAgent.includes("iphone") || userAgent.includes("ipad")) {
    return "ios";
  }
  if (userAgent.includes("android")) {
    return "android";
  }
  return "web";
};

const requireAdmin = (user: {_id?: unknown; admin?: boolean} | undefined): void => {
  if (!user?.admin) {
    throw new APIError({status: 403, title: "Admin access required"});
  }
};

const getUserId = (user: {_id?: unknown; id?: string}): string => {
  const userId = user._id ?? user.id;
  if (!userId) {
    throw new APIError({status: 401, title: "Authentication required"});
  }
  return String(userId);
};

export class AnnouncementsApp implements TerrenoPlugin {
  private options: AnnouncementsOptions;

  constructor(options?: AnnouncementsOptions) {
    this.options = options ?? {};
  }

  adminContribution(): AdminContribution {
    return {
      models: [
        {
          admin: {
            defaultSort: "-priority,-publishedAt",
            displayName: "Announcements",
            group: "Content",
            listDisplayLinks: ["title"],
            listFields: [
              "title",
              "status",
              "priority",
              "version",
              "publishedAt",
              "expiresAt",
              "requiresAcknowledgement",
            ],
            searchFields: ["title"],
            sortableFields: ["title", "status", "priority", "version", "publishedAt", "created"],
          },
          model: Announcement as Model<AnnouncementDocument>,
          routePath: "/announcements",
        },
        {
          admin: {
            defaultSort: "-acknowledgedAt",
            displayName: "Announcement Acknowledgements",
            listFields: ["userId", "announcementId", "version", "acknowledgedAt"],
          },
          model: AnnouncementAcknowledgement as Model<unknown>,
          routePath: "/announcement-acknowledgements",
        },
        {
          admin: {
            defaultSort: "-viewedAt",
            displayName: "Announcement Impressions",
            listFields: ["userId", "announcementId", "version", "viewedAt", "platform"],
          },
          model: AnnouncementImpression as Model<unknown>,
          routePath: "/announcement-impressions",
        },
      ],
    };
  }

  register(app: Application, openApi?: unknown): void {
    const basePath = this.options.basePath ?? DEFAULT_BASE_PATH;
    const acknowledgementMode: AcknowledgementMode = this.options.acknowledgementMode ?? "admin";
    const matchAudience = this.options.matchAudience ?? (() => true);

    const routerOptions: ModelRouterOptions<AnnouncementDocument> = {
      ...(openApi ? {openApi: openApi as OpenApiMiddleware} : {}),
      permissions: {
        create: [Permissions.IsAdmin],
        delete: [Permissions.IsAdmin],
        list: [Permissions.IsAdmin],
        read: [Permissions.IsAdmin],
        update: [Permissions.IsAdmin],
        ...this.options.permissions,
      },
      queryFields: ["status", "priority", "title"],
      sort: "-priority,-publishedAt",
    };

    const userRouter = Router();

    userRouter.get(
      "/pending",
      authenticateMiddleware(),
      asyncHandler(async (req: Request, res: Response) => {
        const user = req.user;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const userId = getUserId(user as {_id?: unknown; id?: string});
        const platform = parsePlatform(req);
        const published = await Announcement.find({status: "published"});
        const audienceFiltered: AnnouncementDocument[] = [];
        for (const announcement of published) {
          const matches = await matchAudience(user, announcement);
          if (matches) {
            audienceFiltered.push(announcement);
          }
        }

        const acknowledgements = await AnnouncementAcknowledgement.find({userId}).select(
          "announcementId version"
        );
        const impressions = await AnnouncementImpression.find({userId}).select(
          "announcementId version"
        );

        const pending = selectPendingAnnouncements({
          acknowledgementMode,
          acknowledgements: acknowledgements.map((ack) => ({
            announcementId: ack.announcementId.toString(),
            version: ack.version,
          })),
          announcements: audienceFiltered,
          impressions: impressions.map((impression) => ({
            announcementId: impression.announcementId.toString(),
            version: impression.version,
          })),
          platform,
        });

        const current = pending[0] ? toAnnouncementPublic(pending[0]) : null;
        const remainingCount = Math.max(pending.length - (current ? 1 : 0), 0);

        logger.info("Pending announcements fetched", {
          currentId: current?.id,
          platform,
          remainingCount,
          userId,
        });

        return res.json({data: {current, remainingCount}});
      })
    );

    userRouter.get(
      "/feed",
      authenticateMiddleware(),
      asyncHandler(async (req: Request, res: Response) => {
        const user = req.user;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const platform = parsePlatform(req);
        const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
        const page = Math.max(Number(req.query.page ?? 1), 1);
        const published = await Announcement.find({status: "published"});
        const visible: AnnouncementDocument[] = [];

        for (const announcement of published) {
          const matchesAudience = await matchAudience(user, announcement);
          if (!matchesAudience) {
            continue;
          }
          if (!isAnnouncementVisibleNow({announcement})) {
            continue;
          }
          if (!matchesPlatform({announcement, platform})) {
            continue;
          }
          visible.push(announcement);
        }

        const sorted = visible.sort((left, right) => {
          if (right.priority !== left.priority) {
            return right.priority - left.priority;
          }
          const rightPublished = right.publishedAt?.getTime() ?? 0;
          const leftPublished = left.publishedAt?.getTime() ?? 0;
          return rightPublished - leftPublished;
        });

        const start = (page - 1) * limit;
        const pageItems = sorted.slice(start, start + limit).map(toAnnouncementPublic);

        return res.json({
          data: pageItems,
          page,
          total: sorted.length,
        });
      })
    );

    userRouter.post(
      "/:id/acknowledge",
      authenticateMiddleware(),
      asyncHandler(async (req: Request, res: Response) => {
        const user = req.user;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const userId = getUserId(user as {_id?: unknown; id?: string});
        const announcement = await Announcement.findById(req.params.id);
        if (announcement?.status !== "published") {
          throw new APIError({status: 404, title: "Announcement not found"});
        }

        const existing = await AnnouncementAcknowledgement.findOne({
          announcementId: announcement._id,
          userId,
          version: announcement.version,
        });

        if (!existing) {
          await AnnouncementAcknowledgement.create({
            acknowledgedAt: DateTime.utc().toJSDate(),
            announcementId: announcement._id,
            userId,
            version: announcement.version,
          });
        }

        return res.json({data: {acknowledged: true}});
      })
    );

    userRouter.post(
      "/:id/impression",
      authenticateMiddleware(),
      asyncHandler(async (req: Request, res: Response) => {
        const user = req.user;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const userId = getUserId(user as {_id?: unknown; id?: string});
        const announcement = await Announcement.findById(req.params.id);
        if (announcement?.status !== "published") {
          throw new APIError({status: 404, title: "Announcement not found"});
        }

        const bodyPlatform = (req.body as {platform?: unknown})?.platform;
        const platform = isValidPlatform(bodyPlatform) ? bodyPlatform : parsePlatform(req);

        await AnnouncementImpression.create({
          announcementId: announcement._id,
          platform,
          userId,
          version: announcement.version,
          viewedAt: DateTime.utc().toJSDate(),
        });

        return res.json({data: {recorded: true}});
      })
    );

    const adminRouter = Router();

    adminRouter.post(
      "/:id/publish",
      authenticateMiddleware(),
      asyncHandler(async (req: Request, res: Response) => {
        requireAdmin(req.user as {_id?: unknown; admin?: boolean} | undefined);
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
          throw new APIError({status: 404, title: "Announcement not found"});
        }
        if (announcement.status !== "draft") {
          throw new APIError({
            status: 400,
            title: "Only draft announcements can be published",
          });
        }

        announcement.status = "published";
        announcement.publishedAt = DateTime.utc().toJSDate();
        await announcement.save();

        logger.info("Announcement published", {announcementId: announcement._id.toString()});
        return res.json({data: announcement});
      })
    );

    adminRouter.post(
      "/:id/archive",
      authenticateMiddleware(),
      asyncHandler(async (req: Request, res: Response) => {
        requireAdmin(req.user as {_id?: unknown; admin?: boolean} | undefined);
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
          throw new APIError({status: 404, title: "Announcement not found"});
        }
        if (announcement.status !== "published") {
          throw new APIError({
            status: 400,
            title: "Only published announcements can be archived",
          });
        }

        announcement.status = "archived";
        announcement.archivedAt = DateTime.utc().toJSDate();
        await announcement.save();

        logger.info("Announcement archived", {announcementId: announcement._id.toString()});
        return res.json({data: announcement});
      })
    );

    app.use(basePath, userRouter);
    app.use(basePath, adminRouter);
    if (this.options.help?.enabled) {
      registerAnnouncementHelpRoutes({app, basePath});
    }
    app.use(basePath, modelRouter(Announcement as Model<AnnouncementDocument>, routerOptions));

    app.use(
      "/announcement-acknowledgements",
      modelRouter(AnnouncementAcknowledgement as Model<unknown>, {
        permissions: {
          create: [],
          delete: [],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [],
        },
        populatePaths: [
          {fields: ["title", "version", "status"], path: "announcementId"},
          {fields: ["email", "name"], path: "userId"},
        ],
      })
    );

    app.use(
      "/announcement-impressions",
      modelRouter(AnnouncementImpression as Model<unknown>, {
        permissions: {
          create: [],
          delete: [],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [],
        },
        populatePaths: [
          {fields: ["title", "version", "status"], path: "announcementId"},
          {fields: ["email", "name"], path: "userId"},
        ],
      })
    );

    logger.info("AnnouncementsApp registered", {acknowledgementMode, basePath});
  }
}
