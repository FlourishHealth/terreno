import {asyncHandler, createOpenApiBuilder, type ModelRouterOptions} from "@terreno/api";
import type {Request, Response} from "express";
import {User} from "../models/user";

export const addHealthRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Express Router type mismatch between packages
  router: any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic model router options
  options?: Partial<ModelRouterOptions<any>>
): void => {
  router.get(
    "/health",
    [
      createOpenApiBuilder(options ?? {})
        .withTags(["health"])
        .withSummary("Health check")
        .withResponse(200, {
          status: {type: "string"},
          timestamp: {type: "string"},
          userCount: {type: "number"},
        })
        .build(),
    ],
    asyncHandler(async (_req: Request, res: Response) => {
      const userCount = await User.countDocuments();

      return res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        userCount,
      });
    })
  );
};
