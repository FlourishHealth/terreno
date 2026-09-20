import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  getNotificationService,
  type ModelRouterOptions,
} from "@terreno/api";
import type express from "express";

interface AuthenticatedUser {
  id: string;
}

const getAuthenticatedUser = (req: express.Request): AuthenticatedUser => {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user?.id) {
    throw new APIError({status: 401, title: "Authentication required"});
  }
  return user;
};

export const addDevNotificationRoutes = (
  router: express.Router,
  options?: Partial<ModelRouterOptions<unknown>>
): void => {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  router.post(
    "/notifications/dev/notify",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options ?? {})
        .withTags(["notifications"])
        .withSummary("Send a development test notification to the current user")
        .withRequestBody({
          body: {type: "string"},
          href: {type: "string"},
          kind: {type: "string"},
          title: {type: "string"},
        })
        .withResponse(200, {
          data: {
            properties: {
              notificationId: {type: "string"},
            },
            type: "object",
          },
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const user = getAuthenticatedUser(req);
      const body = req.body as {body?: string; href?: string; kind?: string; title?: string};
      const notificationId = await getNotificationService().notify({
        body: body.body?.trim() ? body.body : "Terreno test notification",
        href: body.href?.trim() ? body.href : "/",
        kind: body.kind?.trim() ? body.kind : "demo",
        title: body.title?.trim() ? body.title : "Test notification",
        userId: user.id,
      });
      return res.json({data: {notificationId}});
    })
  );
};
