import type {ModelRouterOptions} from "@terreno/api";
import {modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";
import {Todo} from "../models";
import type {TodoDocument, UserDocument} from "../types";

export const addTodoRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Router type flexibility
  router: any,
  options?: Partial<ModelRouterOptions<TodoDocument>>
): void => {
  router.use(
    "/todos",
    modelRouter(Todo, {
      ...options,
      mcp: {
        excludeFields: ["ownerId"],
        maxLimit: 25,
        methods: ["list", "read"],
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
          ownerId: (req.user as UserDocument)?._id,
        } as TodoDocument;
      },
      queryFields: ["completed", "ownerId"],
      queryFilter: OwnerQueryFilter,
      sort: "-created",
      validation: {
        excludeFromCreate: ["ownerId"],
        excludeFromUpdate: ["ownerId"],
        validateCreate: true,
        validateQuery: true,
        validateUpdate: true,
      },
    })
  );
};
