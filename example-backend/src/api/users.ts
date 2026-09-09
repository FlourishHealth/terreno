import type {JSONValue} from "@terreno/api";
import {modelRouter, Permissions} from "@terreno/api";
import type {Document, Model} from "mongoose";
import {User} from "../models/user";
import type {UserDocument} from "../types/models/userTypes";

type SerializableUser = UserDocument | (Document & UserDocument);

const serializeUser = (doc: SerializableUser): Record<string, unknown> => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const {hash, salt, ...rest} = obj as Record<string, unknown> & {hash?: unknown; salt?: unknown};
  return rest;
};

export const usersRouter = modelRouter("/users", User as unknown as Model<UserDocument>, {
  admin: {
    adminAccess: {},
    defaultSort: "-created",
    displayName: "Users",
    fieldsets: [
      {fields: ["email", "name"], title: "Profile"},
      {fields: ["admin", "roles", "oauthProvider"], title: "Access"},
    ],
    filters: [{field: "admin", kind: "boolean", label: "Admin user"}],
    group: "Demo: shared app data",
    hiddenFields: ["hash", "salt"],
    listDisplayLinks: ["email"],
    listFields: ["email", "name", "admin", "emailVerified", "created"],
    pageSize: 50,
    readonlyFields: ["email"],
    recordTitleField: "name",
    searchFields: ["email", "name"],
    sortableFields: ["email", "name", "admin", "created"],
  },
  mcp: {
    excludeFields: ["hash", "salt", "attempts", "last"],
    methods: ["list", "read"],
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
