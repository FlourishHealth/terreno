import type {ModelRouterOptions} from "@terreno/api";
import {modelRouter, Permissions} from "@terreno/api";
import {User} from "../models";

// biome-ignore lint/suspicious/noExplicitAny: Generic
const serializeUser = (doc: any): Record<string, unknown> => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const {hash, salt, ...rest} = obj;
  return rest as Record<string, unknown>;
};

export const addUserRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Router type flexibility
  router: any,
  // biome-ignore lint/suspicious/noExplicitAny: User model typing remains flexible.
  options?: Partial<ModelRouterOptions<any>>
): void => {
  router.use(
    "/users",
    // biome-ignore lint/suspicious/noExplicitAny: User model type mismatch
    modelRouter(User as any, {
      ...options,
      permissions: {
        create: [Permissions.IsAdmin],
        delete: [Permissions.IsAdmin],
        list: [Permissions.IsAdmin],
        read: [Permissions.IsAdmin],
        update: [Permissions.IsAdmin],
      },
      queryFields: ["email", "name"],
      // biome-ignore lint/suspicious/noExplicitAny: Generic
      responseHandler: async (value, _method, _req, _options): Promise<any> => {
        if (Array.isArray(value)) {
          return value.map(serializeUser);
        }
        return serializeUser(value);
      },
      sort: "-created",
    })
  );
};
