import {type ModelRouterOptions, modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {Todo} from "../models";
import type {TodoDocument, UserDocument} from "../types";

export const addTodoRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Express Router type mismatch between packages
  router: any,
  options?: Partial<ModelRouterOptions<TodoDocument>>
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
          ownerId: (req.user as UserDocument)?._id,
        } as TodoDocument;
      },
      queryFields: ["completed", "ownerId"],
      // Filter list queries to only show user's own todos
      queryFilter: OwnerQueryFilter,
      sort: "-created",
    })
  );
};
