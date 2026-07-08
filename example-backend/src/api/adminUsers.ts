import type {ModelRouterOptions} from "@terreno/api";
import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  requireAdminMiddleware,
  setPasswordForUser,
} from "@terreno/api";
import type express from "express";
import {User} from "../models";

interface SetUserPasswordRequest {
  password?: string;
}

export const addAdminUserRoutes = (
  router: express.Application,
  options?: Partial<ModelRouterOptions<unknown>>
): void => {
  router.post(
    "/admin/users/:id/password",
    [
      authenticateMiddleware(),
      requireAdminMiddleware,
      createOpenApiBuilder(options ?? {})
        .withTags(["admin-users"])
        .withSummary("Set a user's password as an admin")
        .withPathParameter("id", {description: "User ID", type: "string"})
        .withRequestBody({
          password: {
            description: "New password for the user",
            type: "string",
          },
        })
        .withResponse(200, {
          data: {
            properties: {
              _id: {type: "string"},
              message: {type: "string"},
            },
            type: "object",
          },
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request<{id: string}>, res: express.Response) => {
      const {password} = req.body as SetUserPasswordRequest;
      if (!password || password.trim().length < 8) {
        throw new APIError({status: 400, title: "Password must be at least 8 characters"});
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        throw new APIError({status: 404, title: "User not found"});
      }

      await setPasswordForUser(user, password);
      await user.save();

      return res.json({data: {_id: user._id.toString(), message: "Password updated"}});
    })
  );
};
