import {asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type express from "express";

import {requireAdmin} from "../../langfuseRoutesMiddleware";
import type {LocalExperimentRunner} from "../local/experimentRunner";

const BASE_PATH = "/ai/observability";

export interface ObservabilityExperimentRouteOptions {
  openApi?: unknown;
  runner: LocalExperimentRunner;
}

export const addObservabilityExperimentRoutes = (
  router: express.Application,
  options: ObservabilityExperimentRouteOptions
): void => {
  const openApiOptions = options.openApi ? {openApi: options.openApi} : {};
  const builder = (): ReturnType<typeof createOpenApiBuilder> => {
    return createOpenApiBuilder(openApiOptions as Parameters<typeof createOpenApiBuilder>[0]);
  };

  router.post(
    `${BASE_PATH}/experiments/estimate`,
    [
      authenticateMiddleware(),
      requireAdmin,
      builder()
        .withTags(["observability"])
        .withSummary("Estimate experiment cost and runtime")
        .withResponse(200, {})
        .build(),
    ],
    asyncHandler(async (req, res) => {
      const data = await options.runner.estimate(req.body);
      return res.json({data});
    })
  );

  router.get(
    `${BASE_PATH}/experiments`,
    [
      authenticateMiddleware(),
      requireAdmin,
      builder()
        .withTags(["observability"])
        .withSummary("List experiments")
        .withResponse(200, {})
        .build(),
    ],
    asyncHandler(async (_req, res) => {
      return res.json({data: await options.runner.list()});
    })
  );

  router.post(
    `${BASE_PATH}/experiments`,
    [
      authenticateMiddleware(),
      requireAdmin,
      builder()
        .withTags(["observability"])
        .withSummary("Create an experiment")
        .withResponse(201, {})
        .build(),
    ],
    asyncHandler(async (req, res) => {
      const data = await options.runner.create(req.body);
      return res.status(201).json({data});
    })
  );

  router.get(
    `${BASE_PATH}/experiments/:id`,
    [
      authenticateMiddleware(),
      requireAdmin,
      builder()
        .withTags(["observability"])
        .withSummary("Get experiment detail")
        .withPathParameter("id", {type: "string"})
        .withResponse(200, {})
        .build(),
    ],
    asyncHandler(async (req, res) => {
      return res.json({data: await options.runner.get(req.params.id)});
    })
  );

  router.post(
    `${BASE_PATH}/experiments/:id/promote`,
    [
      authenticateMiddleware(),
      requireAdmin,
      builder()
        .withTags(["observability"])
        .withSummary("Promote a passing experiment version to production")
        .withPathParameter("id", {type: "string"})
        .withResponse(200, {})
        .build(),
    ],
    asyncHandler(async (req, res) => {
      const body = req.body as {version?: number};
      const experiment = await options.runner.get(req.params.id);
      const version = body.version ?? experiment.versions[experiment.versions.length - 1];
      const data = await options.runner.promote(req.params.id, version);
      return res.json({data});
    })
  );
};
