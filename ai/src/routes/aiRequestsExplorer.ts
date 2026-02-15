import {asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type express from "express";

import {AIRequest} from "../models/aiRequest";
import type {AiRequestsExplorerRouteOptions} from "../types";

export const addAiRequestsExplorerRoutes = (
  router: any,
  options?: AiRequestsExplorerRouteOptions
): void => {
  router.get(
    "/aiRequestsExplorer",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options?.openApiOptions ?? {})
        .withTags(["admin"])
        .withSummary("List AI requests (admin only)")
        .withQueryParameter("page", {type: "number"}, {required: false})
        .withQueryParameter("limit", {type: "number"}, {required: false})
        .withQueryParameter("requestType", {type: "string"}, {required: false})
        .withQueryParameter("model", {type: "string"}, {required: false})
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
      const user = (req as any).user;
      if (!user?.admin) {
        return res.status(403).json({error: "Admin access required"});
      }

      const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20)
      );
      const skip = (page - 1) * limit;

      const match: Record<string, any> = {deleted: {$ne: true}};

      if (req.query.requestType) {
        match.requestType = req.query.requestType;
      }
      if (req.query.model) {
        match.aiModel = req.query.model;
      }
      if (req.query.startDate || req.query.endDate) {
        match.created = {};
        if (req.query.startDate) {
          match.created.$gte = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          match.created.$lte = new Date(req.query.endDate as string);
        }
      }

      const [results, totalCount] = await Promise.all([
        AIRequest.aggregate([
          {$match: match},
          {$sort: {created: -1}},
          {$skip: skip},
          {$limit: limit},
          {
            $lookup: {
              as: "user",
              foreignField: "_id",
              from: "users",
              localField: "userId",
            },
          },
          {$unwind: {path: "$user", preserveNullAndEmptyArrays: true}},
          {
            $project: {
              aiModel: 1,
              created: 1,
              error: 1,
              prompt: {$substrCP: ["$prompt", 0, 200]},
              requestType: 1,
              response: {$substrCP: [{$ifNull: ["$response", ""]}, 0, 200]},
              responseTime: 1,
              tokensUsed: 1,
              "user.email": 1,
              "user.name": 1,
              userId: 1,
            },
          },
        ]),
        AIRequest.countDocuments(match),
      ]);

      return res.json({
        data: results,
        limit,
        more: skip + limit < totalCount,
        page,
        total: totalCount,
      });
    })
  );
};
