import type express from "express";
import type {NextFunction} from "express";
import type {RESTMethod} from "../api";
import {APIError} from "../errors";
import type {PermissionMethod} from "../permissions";
import type {Statements} from "./statements";
import type {AccessCheckArgs, AccessResult, PermissionRequest} from "./types";

export const createIsPermitted =
  <S extends Statements>({can}: {can: (args: AccessCheckArgs<S>) => Promise<AccessResult>}) =>
  (permissions: PermissionRequest<S>): PermissionMethod<unknown> => {
    return async (_method: RESTMethod, user, obj) => {
      const result = await can({
        doc: obj,
        permissions,
        user,
      });
      return result.allowed;
    };
  };

export const IsPermitted = createIsPermitted;

export const createRequireAccess =
  <S extends Statements>({can}: {can: (args: AccessCheckArgs<S>) => Promise<AccessResult>}) =>
  (
    permissions: PermissionRequest<S>,
    options?: {getDoc?: (req: express.Request) => Promise<unknown>}
  ) => {
    return async (req: express.Request, _res: express.Response, next: NextFunction) => {
      const doc = options?.getDoc ? await options.getDoc(req) : undefined;
      const result = await can({
        context: {req},
        doc,
        permissions,
        user: req.user,
      });

      if (!result.allowed) {
        throw new APIError({
          status: 403,
          title: result.reason ?? "Access denied",
        });
      }

      return next();
    };
  };

export const requireAccess = createRequireAccess;
