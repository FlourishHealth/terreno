import type {JSONValue, ModelRouterOptions} from "@terreno/api";
import {modelRouter, Permissions} from "@terreno/api";
import type express from "express";
import type {Document, Model} from "mongoose";
import {User} from "../models/user";
import type {UserDocument} from "../types/models/userTypes";

type SerializableUser = UserDocument | (Document & UserDocument);

const serializeUser = (doc: SerializableUser): Record<string, unknown> => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const {hash, salt, ...rest} = obj as Record<string, unknown> & {hash?: unknown; salt?: unknown};
  return rest;
};

export const addUserRoutes = (
  router: express.Router,
  options?: Partial<ModelRouterOptions<UserDocument>>
): void => {
  router.use(
    "/users",
    modelRouter(User as unknown as Model<UserDocument>, {
      ...options,
      permissions: {
        create: [Permissions.IsAdmin],
        delete: [Permissions.IsAdmin],
        list: [Permissions.IsAdmin],
        read: [Permissions.IsAdmin],
        update: [Permissions.IsAdmin],
      },
      queryFields: ["email", "name"],
      responseHandler: async (value): Promise<JSONValue> => {
        if (Array.isArray(value)) {
          return value.map(serializeUser) as JSONValue;
        }
        return serializeUser(value) as JSONValue;
      },
      sort: "-created",
    })
  );
};
