import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  type ModelRouterOptions,
  modelRouter,
  type OpenApiMiddleware,
  Permissions,
} from "@terreno/api";
import express from "express";
import {DateTime} from "luxon";
import type {Model} from "mongoose";
import {PushToken} from "../models/pushToken";
import type {PushTokenDocument, PushTokenPlatform} from "../modelTypes";

interface PushTokenRouteOptions {
  basePath?: string;
  openApi?: unknown;
}

interface PushTokenRequestBody {
  deviceId?: string;
  platform?: PushTokenPlatform;
  token?: string;
}

const platformValues: PushTokenPlatform[] = ["android", "ios", "web"];

const openApiOptions = (openApi?: unknown): {openApi?: OpenApiMiddleware} =>
  openApi ? {openApi: openApi as OpenApiMiddleware} : {};

const getAuthenticatedUser = (
  req: express.Request
): {_id: unknown; admin?: boolean; id?: string} => {
  const user = req.user as {_id?: unknown; admin?: boolean; id?: string} | undefined;
  if (!user?._id) {
    throw new APIError({status: 401, title: "Authentication required"});
  }
  return user as {_id: unknown; admin?: boolean; id?: string};
};

export const addPushTokenRoutes = (
  app: express.Application,
  options?: PushTokenRouteOptions
): void => {
  const basePath = options?.basePath ?? "/comms/pushTokens";
  const router = express.Router();
  const routeOpenApi = openApiOptions(options?.openApi);

  router.post(
    "/",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["comms"])
        .withSummary("Register or refresh a push token")
        .withRequestBody({
          deviceId: {type: "string"},
          platform: {
            description: "Device platform: android, ios, or web",
            required: true,
            type: "string",
          },
          token: {required: true, type: "string"},
        })
        .withResponse(200, {data: {type: "object"}})
        .withResponse(201, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const user = getAuthenticatedUser(req);
      const body = req.body as PushTokenRequestBody;
      if (!body.token?.trim()) {
        throw new APIError({status: 400, title: "Push token is required"});
      }
      if (!body.platform || !platformValues.includes(body.platform)) {
        throw new APIError({status: 400, title: "Valid push platform is required"});
      }

      const existing = await PushToken.findOneOrNone({token: body.token});
      const token = await PushToken.upsert(
        {token: body.token},
        {
          active: true,
          deviceId: body.deviceId,
          lastSeenAt: DateTime.utc().toJSDate(),
          platform: body.platform,
          userId: user._id,
        }
      );
      return res.status(existing ? 200 : 201).json({data: token});
    })
  );

  router.delete(
    "/:id",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["comms"])
        .withSummary("Deactivate a push token")
        .withPathParameter("id", {type: "string"})
        .withResponse(204, {})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const user = getAuthenticatedUser(req);
      const token = await PushToken.findExactlyOne({_id: req.params.id});
      const isOwner = token.userId.toString() === String(user._id);
      if (!isOwner && !user.admin) {
        throw new APIError({status: 403, title: "Push token belongs to another user"});
      }

      token.active = false;
      await token.save();
      return res.status(204).send();
    })
  );

  const routerOptions: ModelRouterOptions<PushTokenDocument> = {
    ...routeOpenApi,
    permissions: {
      create: [],
      delete: [],
      list: [Permissions.IsAuthenticated],
      read: [Permissions.IsOwner],
      update: [],
    },
    queryFields: ["active", "platform"],
    queryFilter: (user) => {
      if (!user) {
        return null;
      }
      return {userId: user.id};
    },
    sort: "-lastSeenAt",
  };
  router.use(modelRouter(PushToken as Model<PushTokenDocument>, routerOptions));
  app.use(basePath, router);
};
