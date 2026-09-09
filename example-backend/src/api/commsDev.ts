import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  type ModelRouterOptions,
} from "@terreno/api";
import {getCommsService} from "@terreno/comms";
import type express from "express";

interface AuthenticatedUser {
  _id: unknown;
}

const getAuthenticatedUser = (req: express.Request): AuthenticatedUser => {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user?._id) {
    throw new APIError({status: 401, title: "Authentication required"});
  }
  return user;
};

export const addDevCommsRoutes = (
  router: express.Router,
  options?: Partial<ModelRouterOptions<unknown>>
): void => {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  router.post(
    "/comms/dev/testPush",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options ?? {})
        .withTags(["comms"])
        .withSummary("Send a development test push to the caller's registered devices")
        .withRequestBody({
          body: {type: "string"},
          title: {type: "string"},
        })
        .withResponse(200, {
          data: {
            properties: {
              accepted: {type: "number"},
              results: {items: {type: "object"}, type: "array"},
              tokenCount: {type: "number"},
            },
            type: "object",
          },
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const user = getAuthenticatedUser(req);
      const body = req.body as {body?: string; title?: string};
      const results = await getCommsService().sendPushToUser({
        body: body.body?.trim() ? body.body : "Terreno test notification",
        title: body.title?.trim() ? body.title : "Test push",
        userId: String(user._id),
      });
      return res.json({
        data: {
          accepted: results.filter((result) => result.accepted).length,
          results,
          tokenCount: results.length,
        },
      });
    })
  );
};
