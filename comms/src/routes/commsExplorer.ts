import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  type OpenApiMiddleware,
} from "@terreno/api";
import type express from "express";
import {DateTime} from "luxon";

import {CommsMessage} from "../models/commsMessage";

interface CommsExplorerRouteOptions {
  path?: string;
  openApi?: unknown;
}

export const addCommsExplorerRoute = (
  app: express.Application,
  options?: CommsExplorerRouteOptions
): void => {
  const routeOpenApi = options?.openApi ? {openApi: options.openApi as OpenApiMiddleware} : {};

  app.get(
    options?.path ?? "/comms/messages",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "comms"])
        .withSummary("List communication delivery attempts")
        .withQueryParameter("page", {type: "number"}, {required: false})
        .withQueryParameter("limit", {type: "number"}, {required: false})
        .withQueryParameter("channel", {type: "string"}, {required: false})
        .withQueryParameter("status", {type: "string"}, {required: false})
        .withQueryParameter("userId", {type: "string"}, {required: false})
        .withQueryParameter("startDate", {type: "string"}, {required: false})
        .withQueryParameter("endDate", {type: "string"}, {required: false})
        .withResponse(200, {
          data: {items: {type: "object"}, type: "array"},
          limit: {type: "number"},
          more: {type: "boolean"},
          page: {type: "number"},
          total: {type: "number"},
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const user = req.user as {admin?: boolean} | undefined;
      if (!user?.admin) {
        throw new APIError({status: 403, title: "Admin access required"});
      }

      const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20)
      );
      const skip = (page - 1) * limit;
      const match: Record<string, unknown> & {created?: {$gte?: Date; $lte?: Date}} = {
        deleted: {$ne: true},
      };

      if (req.query.channel) {
        match.channel = req.query.channel;
      }
      if (req.query.status) {
        match.status = req.query.status;
      }
      if (req.query.userId) {
        match.userId = req.query.userId;
      }
      if (req.query.startDate || req.query.endDate) {
        match.created = {};
      }
      if (req.query.startDate && match.created) {
        const start = DateTime.fromISO(req.query.startDate as string, {zone: "utc"});
        if (!start.isValid) {
          throw new APIError({status: 400, title: "Invalid startDate format"});
        }
        match.created.$gte = start.toJSDate();
      }
      if (req.query.endDate && match.created) {
        const end = DateTime.fromISO(req.query.endDate as string, {zone: "utc"});
        if (!end.isValid) {
          throw new APIError({status: 400, title: "Invalid endDate format"});
        }
        match.created.$lte = end.toJSDate();
      }

      const [messages, total] = await Promise.all([
        CommsMessage.find(match).sort("-created").skip(skip).limit(limit),
        CommsMessage.countDocuments(match),
      ]);
      return res.json({
        data: messages,
        limit,
        more: skip + limit < total,
        page,
        total,
      });
    })
  );
};
