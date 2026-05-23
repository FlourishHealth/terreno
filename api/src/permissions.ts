import * as Sentry from "@sentry/bun";
import type express from "express";
import type {NextFunction} from "express";
import mongoose, {type Model} from "mongoose";

import {addPopulateToQuery, type ModelRouterOptions, type RESTMethod} from "./api";
import type {User} from "./auth";
import {APIError} from "./errors";
import {logger} from "./logger";

export type PermissionMethod<T> = (
  method: RESTMethod,
  user?: User,
  obj?: T
) => boolean | Promise<boolean>;

export interface RESTPermissions<T> {
  create: PermissionMethod<T>[];
  list: PermissionMethod<T>[];
  read: PermissionMethod<T>[];
  update: PermissionMethod<T>[];
  delete: PermissionMethod<T>[];
}

export const OwnerQueryFilter = (user?: User) => {
  if (user) {
    return {ownerId: user?.id};
  }
  return null;
};

export const Permissions = {
  IsAdmin: (_method: RESTMethod, user?: User) => {
    return Boolean(user?.admin);
  },
  IsAny: () => {
    return true;
  },
  IsAuthenticated: (_method: RESTMethod, user?: User) => {
    if (!user) {
      return false;
    }
    return Boolean(user.id);
  },
  IsAuthenticatedOrReadOnly: (method: RESTMethod, user?: User) => {
    if (user?.id && !user?.isAnonymous) {
      return true;
    }
    return method === "list" || method === "read";
  },
  IsOwner: (_method: RESTMethod, user?: User, obj?: unknown) => {
    // When checking if we can possibly perform the action, return true.
    if (!obj) {
      return true;
    }
    if (!user) {
      return false;
    }
    if (user?.admin) {
      return true;
    }
    const withOwner = obj as {ownerId?: {_id?: unknown} | unknown};
    const ownerObj = withOwner.ownerId as {_id?: unknown} | undefined;
    const ownerId = ownerObj?._id ?? withOwner.ownerId;
    return Boolean(user?.id && ownerId && String(ownerId) === String(user?.id));
  },
  IsOwnerOrReadOnly: (method: RESTMethod, user?: User, obj?: unknown) => {
    // When checking if we can possibly perform the action, return true.
    if (!obj) {
      return true;
    }
    if (user?.admin) {
      return true;
    }

    const withOwner = obj as {ownerId?: unknown};
    if (user?.id && withOwner.ownerId && String(withOwner.ownerId) === String(user?.id)) {
      return true;
    }
    return method === "list" || method === "read";
  },
};

export const checkPermissions = async <T>(
  method: RESTMethod,
  permissions: PermissionMethod<T>[],
  user?: User,
  obj?: T
): Promise<boolean> => {
  let anyTrue = false;
  for (const perm of permissions) {
    if (!(await perm(method, user, obj))) {
      return false;
    }
    anyTrue = true;
  }
  return anyTrue;
};

// Check the permissions for a given model and method. If the method is a read, update, or delete,
// finds the relevant object, checks the permissions, and attaches the object to the request as
// req.obj.
export const permissionMiddleware = <T>(
  model: Model<T>,
  options: Pick<ModelRouterOptions<T>, "permissions" | "populatePaths">
) => {
  return async (req: express.Request, _res: express.Response, next: NextFunction) => {
    if (req.method === "OPTIONS") {
      return next();
    }
    try {
      let method: "list" | "create" | "read" | "update" | "delete";

      const reqMethod = req.method.toLowerCase();
      if (reqMethod === "post") {
        method = "create";
      } else if (reqMethod === "get") {
        if (req.params.id) {
          method = "read";
        } else {
          method = "list";
        }
      } else if (reqMethod === "patch") {
        method = "update";
      } else if (reqMethod === "delete") {
        method = "delete";
      } else {
        throw new APIError({
          status: 405,
          title: `Method ${req.method} not allowed`,
        });
      }

      // All methods check for permissions.
      if (!(await checkPermissions(method, options.permissions[method], req.user))) {
        throw new APIError({
          status: 405,
          title:
            `Access to ${method.toUpperCase()} on ${model.modelName} ` +
            `denied for ${req.user?.id}`,
        });
      }

      if (method === "create" || method === "list") {
        return next();
      }

      const builtQuery = model.findById(req.params.id);
      const populatedQuery = addPopulateToQuery(
        // biome-ignore lint/suspicious/noExplicitAny: Query types vary based on populate paths
        builtQuery as any,
        options.populatePaths
      );
      let data: T | null;
      try {
        data = (await populatedQuery.exec()) as T | null;
      } catch (error: unknown) {
        throw new APIError({
          error: error as Error,
          status: 500,
          title: `GET failed on ${req.params.id}`,
        });
      }
      if (!data) {
        // Check if document exists but is hidden. Completely skip plugins.
        const hiddenDoc = await model.collection.findOne({
          _id: new mongoose.Types.ObjectId(req.params.id as string),
        });

        if (!hiddenDoc) {
          Sentry.captureMessage(`Document ${req.params.id} not found for model ${model.modelName}`);
          const error = new APIError({
            status: 404,
            title: `Document ${req.params.id} not found for model ${model.modelName}`,
          });
          error.meta = undefined;
          throw error;
        }

        // Document exists but is hidden
        let reason: {[key: string]: string} | null = null;
        if (hiddenDoc.deleted) {
          reason = {deleted: "true"};
        } else if (hiddenDoc.disabled) {
          reason = {disabled: "true"};
        } else if (hiddenDoc.archived) {
          reason = {archived: "true"};
        }

        // If no reason found, treat as not found
        if (!reason) {
          const error = new APIError({
            status: 404,
            title: `Document ${req.params.id} not found for model ${model.modelName}`,
          });
          error.meta = undefined;
          throw error;
        }
        throw new APIError({
          // We don't want to send this to Sentry because it's expected behavior.
          disableExternalErrorTracking: true,
          meta: reason,
          status: 404,
          title: `Document ${req.params.id} not found for model ${model.modelName}`,
        });
      }

      if (!(await checkPermissions(method, options.permissions[method], req.user, data))) {
        throw new APIError({
          status: 403,
          title: `Access to GET on ${model.modelName}:${req.params.id} denied for ${req.user?.id}`,
        });
      }

      (req as express.Request & {obj?: T | null}).obj = data;

      return next();
    } catch (error) {
      logger.error(`Permissions error: ${error instanceof Error ? error.message : error}`);
      return next(error);
    }
  };
};
