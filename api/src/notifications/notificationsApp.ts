import type {Application} from "express";
import {DateTime} from "luxon";
import type {Model} from "mongoose";
import {asyncHandler, type ModelRouterOptions, modelRouter, type OpenApiMiddleware} from "../api";
import {authenticateMiddleware, type User} from "../auth";
import {APIError} from "../errors";
import {logger} from "../logger";
import {Notification} from "../models/notification";
import {NotificationPreference} from "../models/notificationPreference";
import {createOpenApiBuilder} from "../openApiBuilder";
import {OwnerQueryFilter, Permissions} from "../permissions";
import type {TerrenoPlugin} from "../terrenoPlugin";
import type {NotificationDocument} from "../types/notification";
import type {NotificationPreferenceDocument} from "../types/notificationPreference";
import {
  assertValidNotificationReadAt,
  configureNotificationService,
  type NotificationServiceOptions,
  type NotificationsCommsService,
} from "./notificationService";

export interface NotificationsAppOptions extends NotificationServiceOptions {
  getComms?: () => NotificationsCommsService;
  retainDays?: number;
  userModel?: Model<{email?: string; phone?: string}>;
}

const parseReadAt = (value: unknown): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = DateTime.fromISO(value);
    if (!parsed.isValid) {
      throw new APIError({status: 400, title: "readAt must be a date or null"});
    }
    return parsed.toJSDate();
  }
  throw new APIError({status: 400, title: "readAt must be a date or null"});
};

export class NotificationsApp implements TerrenoPlugin {
  private readonly options: NotificationsAppOptions;

  constructor(options: NotificationsAppOptions = {}) {
    this.options = options;
  }

  register(app: Application, openApi?: unknown): void {
    configureNotificationService({
      getComms: this.options.getComms,
      retainDays: this.options.retainDays,
      userModel: this.options.userModel,
    });

    const openApiMiddleware = openApi as OpenApiMiddleware | undefined;
    const sharedRouterOptions: Partial<ModelRouterOptions<NotificationDocument>> = openApiMiddleware
      ? {openApi: openApiMiddleware}
      : {};

    const notificationsRouter = modelRouter<NotificationDocument>("/notifications", Notification, {
      ...sharedRouterOptions,
      endpoints: (router) => {
        router.post(
          "/mark-all-read",
          [
            authenticateMiddleware(),
            createOpenApiBuilder(sharedRouterOptions as Partial<ModelRouterOptions<unknown>>)
              .withTags(["notifications"])
              .withSummary("Mark all of the caller's unread notifications as read")
              .withResponse(200, {
                data: {
                  properties: {modified: {type: "number"}},
                  type: "object",
                },
              })
              .build(),
          ],
          asyncHandler(async (req, res) => {
            const user = req.user as User | undefined;
            if (!user?.id) {
              throw new APIError({status: 401, title: "Authentication required"});
            }

            const unread = await Notification.find({
              $or: [{readAt: null}, {readAt: {$exists: false}}],
              ownerId: user.id,
            });
            const now = DateTime.now().toJSDate();
            let modified = 0;
            for (const row of unread) {
              row.readAt = now;
              await row.save();
              modified += 1;
            }

            logger.info("[notifications] mark-all-read", {modified, userId: user.id});
            return res.json({data: {modified}});
          })
        );
      },
      permissions: {
        create: [],
        delete: [Permissions.IsOwner],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsOwner],
        update: [Permissions.IsOwner],
      },
      preUpdate: (body) => {
        const readAt = (body as {readAt?: unknown}).readAt;
        if (readAt === undefined) {
          return {} as NotificationDocument;
        }
        assertValidNotificationReadAt(readAt);
        return {readAt: parseReadAt(readAt)} as NotificationDocument;
      },
      queryFields: ["_id", "ownerId", "readAt", "kind"],
      queryFilter: OwnerQueryFilter,
      sort: "-created",
      sync: {scope: {type: "owner"}},
    });
    app.use(notificationsRouter.path, notificationsRouter.router);

    const preferencesRouter = modelRouter<NotificationPreferenceDocument>(
      "/notification-preferences",
      NotificationPreference,
      {
        ...(openApiMiddleware ? {openApi: openApiMiddleware} : {}),
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [Permissions.IsOwner],
          list: [Permissions.IsAuthenticated],
          read: [Permissions.IsOwner],
          update: [Permissions.IsOwner],
        },
        preCreate: (body, req) => {
          const user = req.user as User | undefined;
          if (!user?.id) {
            throw new APIError({status: 401, title: "Authentication required"});
          }
          const payload = body as Partial<NotificationPreferenceDocument>;
          return {
            ...payload,
            ownerId: user.id,
          } as unknown as NotificationPreferenceDocument;
        },
        queryFields: ["ownerId"],
        queryFilter: OwnerQueryFilter,
        sort: "-created",
        sync: {scope: {type: "owner"}},
      }
    );
    app.use(preferencesRouter.path, preferencesRouter.router);

    logger.info("NotificationsApp registered", {retainDays: this.options.retainDays ?? 0});
  }
}
