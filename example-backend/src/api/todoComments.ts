import {modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {TodoComment} from "../models";
import type {TodoCommentDocument, UserDocument} from "../types";

/**
 * TodoComment CRUD, owner-scoped and realtime-enabled. Demonstrates a related
 * collection synced via @terreno/syncdb (comments belong to a todo).
 */
export const todoCommentRouter = modelRouter("/todoComments", TodoComment, {
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
      ownerId: (req.user as unknown as UserDocument)?._id,
    } as TodoCommentDocument;
  },
  queryFields: ["ownerId", "todoId"],
  queryFilter: OwnerQueryFilter,
  realtime: {
    methods: ["create", "update", "delete"],
    roomStrategy: "owner",
  },
  sort: "-created",
  validation: {
    excludeFromCreate: ["ownerId"],
    excludeFromUpdate: ["ownerId"],
    validateCreate: true,
    validateQuery: true,
    validateUpdate: true,
  },
});
