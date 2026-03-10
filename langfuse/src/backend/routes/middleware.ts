import {APIError, Permissions} from "@terreno/api";
import type {NextFunction, Request, Response} from "express";

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!Permissions.IsAdmin(req.user as Parameters<typeof Permissions.IsAdmin>[0], undefined)) {
    throw new APIError({disableExternalErrorTracking: true, status: 403, title: "Forbidden"});
  }
  next();
};
