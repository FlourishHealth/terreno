import type {ModelRouterOptions} from "@terreno/api";
import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type express from "express";
import {User} from "../models";

interface SetUserPasswordRequest {
  password?: string;
}

const PASSWORD_SET_TIMEOUT_MS = 15_000;

const setUserPassword = async (
  user: {
    setPassword: (
      password: string,
      callback?: (error?: unknown) => void
    ) => Promise<unknown> | unknown;
  },
  password: string
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    let isSettled = false;
    const timeout = setTimeout(() => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      reject(new Error("Timed out while setting password"));
    }, PASSWORD_SET_TIMEOUT_MS);

    const resolveOnce = (): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      resolve();
    };

    const rejectOnce = (error: unknown): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      reject(error);
    };

    try {
      const maybePromise = user.setPassword(password, (error?: unknown) => {
        if (error) {
          rejectOnce(error);
          return;
        }
        resolveOnce();
      });

      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
        (maybePromise as Promise<unknown>).then(resolveOnce).catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
};

const adminGuard = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): void => {
  const user = req.user as {admin?: boolean} | undefined;
  if (!user?.admin) {
    throw new APIError({status: 403, title: "Admin access required"});
  }
  next();
};

export const addAdminUserRoutes = (
  router: express.Application,
  options?: Partial<ModelRouterOptions<unknown>>
): void => {
  router.post(
    "/admin/users/:id/password",
    [
      authenticateMiddleware(),
      adminGuard,
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

      await setUserPassword(user, password);
      await user.save();

      return res.json({data: {_id: user._id.toString(), message: "Password updated"}});
    })
  );
};
