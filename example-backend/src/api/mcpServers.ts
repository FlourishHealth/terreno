import {modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {McpServer} from "../models";
import type {McpServerDocument, UserDocument} from "../types";

export const mcpServerRouter = modelRouter("/mcp-servers", McpServer, {
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
    } as McpServerDocument;
  },
  queryFields: ["enabled", "ownerId"],
  queryFilter: OwnerQueryFilter,
  sort: "name",
  validation: {
    excludeFromCreate: ["ownerId"],
    validateCreate: true,
    validateQuery: true,
    validateUpdate: true,
  },
});
