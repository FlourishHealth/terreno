import {type ModelRouterOptions, modelRouter, Permissions} from "@terreno/api";
import {GptHistory} from "../models/gptHistory";
import type {GptHistoryDocument, GptHistoryRouteOptions} from "../types";

export const addGptHistoryRoutes = (
  router: any,
  options?: Partial<ModelRouterOptions<GptHistoryDocument>> & GptHistoryRouteOptions
): void => {
  router.use(
    "/gpt/histories",
    modelRouter(GptHistory, {
      ...options,
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
          userId: (req.user as {_id: unknown})?._id,
        } as GptHistoryDocument;
      },
      queryFields: ["userId"],
      queryFilter: (user) => ({userId: user?.id}),
      sort: "-updated",
    })
  );
};
