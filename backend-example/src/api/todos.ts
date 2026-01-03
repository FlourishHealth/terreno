import {type modelRouterOptions, modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {Todo} from "../models";
import type {TodoDocument} from "../types";

// biome-ignore lint/suspicious/noExplicitAny: Express Router type mismatch between packages
export const addTodoRoutes = (
  router: any,
  options?: Partial<modelRouterOptions<TodoDocument>>
): void => {
  router.use(
    "/todos",
    modelRouter(Todo, {
      ...options,
      permissions: {
        create: [Permissions.IsAuthenticated],
        delete: [Permissions.IsOwner],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsOwner],
        update: [Permissions.IsOwner],
      },
      // Automatically set ownerId to current user on create
      preCreate: (body, req) => {
        return {
          ...body,
          ownerId: req.user?._id,
        } as TodoDocument;
      },
      // Filter list queries to only show user's own todos
      queryFilter: OwnerQueryFilter,
      queryFields: ["completed", "ownerId"],
      sort: "-created",
    })
  );
};
