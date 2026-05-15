import type express from "express";
import type {Document} from "mongoose";

import type {ModelRouterOptions} from "./api";
import type {User} from "./auth";
import {APIError} from "./errors";
import {logger} from "./logger";

export interface TerrenoTransformer<T> {
  // Runs before create or update operations. Allows throwing out fields that the user should be
  // able to write to, modify data, check permissions, etc.
  transform?: (obj: Partial<T>, method: "create" | "update", user?: User) => Partial<T> | undefined;
  // Runs after create/update operations but before data is returned from the API. Serialize fetched
  // data, dropping fields based on user, changing data, etc.
  serialize?: (obj: T, user?: User) => Partial<T> | undefined;
}

const getUserType = (user?: User, obj?: Record<string, unknown>): "anon" | "auth" | "owner" | "admin" => {
  if (user?.admin) {
    return "admin";
  }
  if (obj && user && String(obj?.ownerId) === String(user?.id)) {
    return "owner";
  }
  if (user?.id) {
    return "auth";
  }
  return "anon";
};

export const AdminOwnerTransformer = <T>(options: {
  anonReadFields?: string[];
  authReadFields?: string[];
  ownerReadFields?: string[];
  adminReadFields?: string[];
  anonWriteFields?: string[];
  authWriteFields?: string[];
  ownerWriteFields?: string[];
  adminWriteFields?: string[];
}): TerrenoTransformer<T> => {
  const pickFields = (obj: Partial<T>, fields: string[]): Partial<T> => {
    const newData: Partial<T> = {};
    for (const field of fields) {
      if ((obj as Record<string, unknown>)[field] !== undefined) {
        (newData as Record<string, unknown>)[field] = (obj as Record<string, unknown>)[field];
      }
    }
    return newData;
  };

  return {
    serialize: (obj: T, user?: User) => {
      const userType = getUserType(user, obj as Record<string, unknown>);
      if (userType === "admin") {
        return pickFields(obj, [...(options.adminReadFields ?? []), "id"]);
      }
      if (userType === "owner") {
        return pickFields(obj, [...(options.ownerReadFields ?? []), "id"]);
      }
      if (userType === "auth") {
        return pickFields(obj, [...(options.authReadFields ?? []), "id"]);
      }
      return pickFields(obj, [...(options.anonReadFields ?? []), "id"]);
    },
    transform: (obj: Partial<T>, _method: "create" | "update", user?: User) => {
      const userType = getUserType(user, obj as Record<string, unknown>);
      let allowedFields: string[];
      if (userType === "admin") {
        allowedFields = options.adminWriteFields ?? [];
      } else if (userType === "owner") {
        allowedFields = options.ownerWriteFields ?? [];
      } else if (userType === "auth") {
        allowedFields = options.authWriteFields ?? [];
      } else {
        allowedFields = options.anonWriteFields ?? [];
      }
      const unallowedFields = Object.keys(obj).filter((k) => !allowedFields.includes(k));
      if (unallowedFields.length) {
        throw new APIError({
          status: 403,
          title: `User of type ${userType} cannot write fields: ${unallowedFields.join(", ")}`,
        });
      }
      return obj;
    },
  };
};

export const transform = <T>(
  options: ModelRouterOptions<T>,
  data: Partial<T> | Partial<T>[],
  method: "create" | "update",
  user?: User
) => {
  if (!options.transformer?.transform) {
    return data;
  }

  logger.warn(
    "transform functions are deprecated, use preCreate/preUpdate/preDelete hooks instead"
  );

  // TS doesn't realize this is defined otherwise...
  const transformFn = options.transformer?.transform;

  if (!Array.isArray(data)) {
    return transformFn(data, method, user);
  }
  return data.map((d) => transformFn(d, method, user));
};

export const serialize = <T>(
  req: express.Request,
  options: ModelRouterOptions<T>,
  data: (Document & T) | (Document & T)[]
) => {
  const serializeFn = (serializeData: Document & T, serializeUser?: User) => {
    const dataObject = serializeData.toObject() as T;
    (dataObject as Record<string, unknown>).id = serializeData._id;

    // Search for any value that is a Map and transform it to a plain object.
    // Otherwise Express drops the contents.
    for (const key in dataObject) {
      const value = dataObject[key];
      if (value instanceof Map) {
        dataObject[key] = Object.fromEntries(value);
      }
    }

    if (options.transformer?.serialize) {
      return options.transformer?.serialize(dataObject, serializeUser);
    }
    return dataObject;
  };

  if (options.transformer?.serialize) {
    logger.warn(
      "transform.serialize functions are deprecated, use post* hooks and serialize instead"
    );
  }
  if (!Array.isArray(data)) {
    return serializeFn(data, req.user);
  }
  return data.map((d) => serializeFn(d, req.user));
};

/**
 * Default response handler for modelRouter. Calls toObject on each doc and returns the result,
 * using transformers.serializer if provided.
 */
export const defaultResponseHandler = async <T>(
  doc: (Document & T) | (Document & T)[] | null,
  method: "list" | "create" | "read" | "update",
  request: express.Request,
  options: ModelRouterOptions<T>
) => {
  if (!doc) {
    return null;
  }
  try {
    return serialize(request, options, doc);
  } catch (error: unknown) {
    const errorObj = error as Error;
    throw new APIError({
      error: errorObj,
      status: 400,
      title: `Error serializing ${method} response: ${errorObj.message}`,
    });
  }
};
