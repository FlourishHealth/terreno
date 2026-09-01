import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type express from "express";

import {requireAdmin} from "../../langfuseRoutesMiddleware";
import {getObservabilityApp} from "../observabilityApp";
import {buildObservabilityStatus} from "../status";

const BASE_PATH = "/ai/observability";

export interface ObservabilityStatusRouteOptions {
  openApi?: unknown;
}

export const addObservabilityStatusRoutes = (
  router: express.Application,
  options: ObservabilityStatusRouteOptions = {}
): void => {
  const openApiOptions = options.openApi ? {openApi: options.openApi} : {};
  const builder = (): ReturnType<typeof createOpenApiBuilder> => {
    return createOpenApiBuilder(openApiOptions as Parameters<typeof createOpenApiBuilder>[0]);
  };

  router.get(
    `${BASE_PATH}/status`,
    [
      authenticateMiddleware(),
      requireAdmin,
      builder()
        .withTags(["observability"])
        .withSummary("Observability plugin status for admin chrome")
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (_req, res) => {
      const app = getObservabilityApp();
      if (!app) {
        throw new APIError({status: 503, title: "ObservabilityApp is not registered"});
      }
      return res.json({data: buildObservabilityStatus(app)});
    })
  );
};
