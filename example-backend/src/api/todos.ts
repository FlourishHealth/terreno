import {modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {Todo} from "../models";
import type {TodoDocument, UserDocument} from "../types";

export const todoRouter = modelRouter("/todos", Todo, {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsOwner],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsOwner],
    update: [Permissions.IsOwner],
  },
  preCreate: (body, req) => {
    return {
      ...body,
      ownerId: (req.user as UserDocument)?._id,
    } as TodoDocument;
  },
  queryFields: ["completed", "ownerId"],
  queryFilter: OwnerQueryFilter,
  sort: "-created",
  validation: {
    excludeFromCreate: ["ownerId"],
    validateCreate: true,
    validateQuery: true,
    validateUpdate: true,
  },
});
