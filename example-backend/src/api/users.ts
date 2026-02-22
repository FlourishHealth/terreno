import {modelRouter, Permissions} from "@terreno/api";
import {User} from "../models";

// biome-ignore lint/suspicious/noExplicitAny: Generic
const serializeUser = (doc: any): Record<string, unknown> => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const {hash, salt, ...rest} = obj;
  return rest as Record<string, unknown>;
};

// biome-ignore lint/suspicious/noExplicitAny: User model type mismatch
export const userRouter = modelRouter("/users", User as any, {
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
});
