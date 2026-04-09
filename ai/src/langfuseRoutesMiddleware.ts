import {APIError, Permissions} from "@terreno/api";
import type {NextFunction, Request, Response} from "express";

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  const user = req.user as Parameters<typeof Permissions.IsAdmin>[1] & {isAdmin?: () => boolean};
  const isAdmin =
    typeof user?.isAdmin === "function" ? user.isAdmin() : Permissions.IsAdmin("read", user);
  if (!isAdmin) {
    throw new APIError({disableExternalErrorTracking: true, status: 403, title: "Forbidden"});
  }
  next();
};
