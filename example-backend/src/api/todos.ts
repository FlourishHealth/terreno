import {adminOwnedBy} from "@terreno/admin-backend";
import {APIError, modelRouter, OwnerQueryFilter, Permissions, z} from "@terreno/api";
import {Todo} from "../models/todo";
import type {TodoDocument} from "../types/models/todoTypes";
import type {UserDocument} from "../types/models/userTypes";

const bulkCompleteBodySchema = z
  .object({
    ids: z.array(z.string()).min(1),
  })
  .strict();

export const todoRouter = modelRouter("/todos", Todo, {
  access: {resource: "todo"},
  admin: {
    actions: [
      {
        confirm: "Mark selected todos as completed?",
        id: "markComplete",
        label: "Mark completed",
        patchKeys: ["completed"],
      },
    ],
    adminAccess: {isOwned: adminOwnedBy("ownerId")},
    adminPermissions: {delete: []},
    bulkPatchAllowlist: ["completed", "priority", "tags"],
    defaultSort: "-created",
    displayName: "Todos",
    fieldsets: [
      {fields: ["title", "tags", "priority", "completed"], title: "Task"},
      {fields: ["ownerId"], title: "Ownership"},
    ],
    filters: [
      {field: "completed", kind: "boolean", label: "Completed"},
      {
        choices: [
          {label: "Low", value: "low"},
          {label: "Medium", value: "medium"},
          {label: "High", value: "high"},
        ],
        field: "priority",
        kind: "choice",
        label: "Priority",
      },
      {field: "created", kind: "dateRange", label: "Created"},
      {field: "ownerId", kind: "ref", label: "Owner", refModel: "User"},
    ],
    group: "Demo: shared app data",
    listDisplay: ["title", "completed", "priority", "ownerId", "created", "tags"],
    listDisplayLinks: ["title"],
    listFields: ["title", "completed", "ownerId", "created", "priority", "tags"],
    pageSize: 25,
    readonlyFields: ["ownerId"],
    realtime: true,
    searchFields: ["title", "tags"],
    sortableFields: ["title", "completed", "created", "priority"],
  },
  collectionActions: {
    bulkComplete: {
      access: {action: "update", resource: "todo"},
      body: bulkCompleteBodySchema,
      handler: async ({body, user}) => {
        const ownerId = (user as unknown as UserDocument)?._id;
        if (!ownerId) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const {ids} = body as z.infer<typeof bulkCompleteBodySchema>;
        // Per-doc loop instead of Todo.updateMany: updateMany throws on synced models
        // because multi-document writes cannot stamp a per-document _syncSeq.
        const todos = await Todo.find({_id: {$in: ids}, ownerId});
        let modified = 0;
        for (const todo of todos) {
          if (todo.completed) {
            continue;
          }
          todo.completed = true;
          await todo.save();
          modified += 1;
        }

        return {matched: todos.length, modified};
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
      access: {action: "update", resource: "todo"},
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
  mcp: {
    excludeFields: ["ownerId"],
    maxLimit: 25,
    methods: ["list", "read", "create", "update", "delete"],
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
  // Local-first sync (@terreno/syncdb): stream = todos|owner:{ownerId}.
  sync: {scope: {type: "owner"}},
  validation: {
    excludeFromCreate: ["ownerId"],
    excludeFromUpdate: ["ownerId"],
    validateCreate: true,
    validateQuery: true,
    validateUpdate: true,
  },
});
