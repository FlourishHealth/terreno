import {type modelRouterOptions, modelRouter, Permissions} from "@terreno/api";
import {User} from "../models";
import type {UserDocument} from "../types";

// biome-ignore lint/suspicious/noExplicitAny: Express Router type mismatch between packages
export const addUserRoutes = (
  router: any,
  options?: Partial<modelRouterOptions<UserDocument>>
): void => {
  router.use(
    "/users",
    modelRouter(User, {
      ...options,
      permissions: {
        create: [Permissions.IsAdmin],
        delete: [Permissions.IsAdmin],
        list: [Permissions.IsAdmin],
        read: [Permissions.IsAdmin],
        update: [Permissions.IsAdmin],
      },
      queryFields: ["email", "name"],
      // Remove sensitive fields from responses
      responseHandler: async (value, _method, _req, _options) => {
        const serialize = (doc: UserDocument): Record<string, unknown> => {
          const obj = doc.toObject ? doc.toObject() : doc;
          // Remove password-related fields
          const {hash, salt, ...rest} = obj as Record<string, unknown>;
          return rest;
        };

        if (Array.isArray(value)) {
          return value.map(serialize);
        }
        return serialize(value as UserDocument);
      },
      sort: "-created",
    })
  );
};

