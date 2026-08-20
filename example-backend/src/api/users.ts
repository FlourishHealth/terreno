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

const buildUserRouterOptions = (
  options?: Partial<ModelRouterOptions<UserDocument>>
): ModelRouterOptions<UserDocument> => ({
  ...options,
  admin: {
    defaultSort: "-created",
    displayName: "Users",
    fieldsets: [
      {fields: ["email", "name"], title: "Profile"},
      {fields: ["admin", "oauthProvider"], title: "Access"},
    ],
    filters: [{field: "admin", kind: "boolean", label: "Admin user"}],
    group: "Demo: shared app data",
    hiddenFields: ["hash", "salt"],
    listDisplayLinks: ["email"],
    listFields: ["email", "name", "admin", "created"],
    pageSize: 50,
    readonlyFields: ["email"],
    recordTitleField: "name",
    searchFields: ["email", "name"],
    sortableFields: ["email", "name", "admin", "created"],
  },
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
});

export const userRouter = modelRouter(
  "/users",
  User as unknown as Model<UserDocument>,
  buildUserRouterOptions()
);

export const addUserRoutes = (
  router: express.Router,
  options?: Partial<ModelRouterOptions<UserDocument>>
): void => {
  router.use(
    "/users",
    modelRouter(User as unknown as Model<UserDocument>, buildUserRouterOptions(options))
  );
};
