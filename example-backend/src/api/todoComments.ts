import {APIError, modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {Todo, TodoComment} from "../models";
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
  preCreate: async (body, req) => {
    const ownerId = (req.user as unknown as UserDocument)?._id;
    if (!ownerId) {
      throw new APIError({status: 401, title: "Authentication required"});
    }
    // A comment may only be attached to a todo the caller owns — otherwise any
    // signed-in user could comment on another user's todo by guessing its id.
    const todoId = (body as Partial<TodoCommentDocument> | undefined)?.todoId;
    if (todoId) {
      const todo = await Todo.findOneOrNone({_id: todoId, ownerId});
      if (!todo) {
        throw new APIError({status: 403, title: "Cannot comment on a todo you do not own"});
      }
    }
    return {
      ...body,
      ownerId,
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
