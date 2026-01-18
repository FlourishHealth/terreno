import {type ModelRouterOptions, modelRouter, Permissions} from "@terreno/api";
import {User} from "../models";
import type {UserDocument} from "../types";

export const addUserRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic
  router: any,
  options?: Partial<ModelRouterOptions<UserDocument>>
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
      // biome-ignore lint/suspicious/noExplicitAny: Generic
      responseHandler: async (value, _method, _req, _options): Promise<any> => {
        const serialize = (doc: UserDocument): Record<string, unknown> => {
          const obj = doc.toObject ? doc.toObject() : doc;
          // Remove password-related fields
          // biome-ignore lint/suspicious/noExplicitAny: Generic
          const {hash, salt, ...rest} = obj as any;
          return rest as Record<string, unknown>;
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
