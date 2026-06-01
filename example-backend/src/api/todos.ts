import {APIError, modelRouter, OwnerQueryFilter, Permissions, z} from "@terreno/api";
import {Todo} from "../models";
import type {TodoDocument, UserDocument} from "../types";

const bulkCompleteBodySchema = z
  .object({
    ids: z.array(z.string()).min(1),
  })
  .strict();

export const todoRouter = modelRouter("/todos", Todo, {
  collectionActions: {
    bulkComplete: {
      body: bulkCompleteBodySchema,
      handler: async ({body, user}) => {
        const ownerId = (user as unknown as UserDocument)?._id;
        if (!ownerId) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const {ids} = body as z.infer<typeof bulkCompleteBodySchema>;
        const result = await Todo.updateMany(
          {_id: {$in: ids}, ownerId},
          {completed: true}
        );

        return {matched: result.matchedCount, modified: result.modifiedCount};
      },
      method: "POST",
      permissions: [Permissions.IsAuthenticated],
      response: z
        .object({
          matched: z.number(),
          modified: z.number(),
        })
        .strict(),
      summary: "Mark multiple todos complete for the current user",
    },
  },
  instanceActions: {
    markComplete: {
      handler: async ({doc}) => {
        const todo = doc as TodoDocument;
        if (todo.completed) {
          return todo;
        }
        todo.completed = true;
        await todo.save();
        return todo;
      },
      method: "POST",
      permissions: [Permissions.IsOwner],
      summary: "Mark a single todo as complete",
    },
  },
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
    } as TodoDocument;
  },
  queryFields: ["completed", "ownerId"],
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
