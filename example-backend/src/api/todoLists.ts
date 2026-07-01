import {modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {TodoList} from "../models";
import type {TodoListDocument, UserDocument} from "../types";

/**
 * TodoList CRUD, owner-scoped and realtime-enabled. Demonstrates a second
 * collection synced via @terreno/syncdb alongside todos (lists group todos).
 */
export const todoListRouter = modelRouter("/todoLists", TodoList, {
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
    } as TodoListDocument;
  },
  queryFields: ["ownerId"],
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
