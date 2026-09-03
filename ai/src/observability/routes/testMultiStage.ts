import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type express from "express";
import type mongoose from "mongoose";

import {requireAdmin} from "../../langfuseRoutesMiddleware";
import {runTestMultiStageWorkflow} from "../testMultiStageWorkflow";
import type {ObservabilityGenerateClient, TraceRecord} from "../types";

const BASE_PATH = "/ai/observability";

export interface ObservabilityTestMultiStageRouteOptions {
  aiService?: ObservabilityGenerateClient;
  exportTrace: (trace: TraceRecord) => Promise<string | undefined>;
  openApi?: unknown;
}

export const addObservabilityTestMultiStageRoutes = (
  router: express.Application,
  options: ObservabilityTestMultiStageRouteOptions
): void => {
  const openApiOptions = options.openApi ? {openApi: options.openApi} : {};
  const builder = (): ReturnType<typeof createOpenApiBuilder> => {
    return createOpenApiBuilder(openApiOptions as Parameters<typeof createOpenApiBuilder>[0]);
  };

  router.post(
    `${BASE_PATH}/traces/test-multi-stage`,
    [
      authenticateMiddleware(),
      requireAdmin,
      builder()
        .withTags(["observability"])
        .withSummary("Run a multi-stage observability workflow and export one nested trace")
        .withRequestBody({
          input: {type: "string"},
        })
        .withResponse(200, {
          data: {
            properties: {
              output: {
                properties: {
                  keywords: {items: {type: "string"}, type: "array"},
                  metrics: {type: "object"},
                  phrase: {type: "string"},
                  sentence: {type: "string"},
                },
                type: "object",
              },
              stages: {
                items: {
                  properties: {
                    name: {type: "string"},
                    status: {type: "string"},
                  },
                  type: "object",
                },
                type: "array",
              },
              traceId: {type: "string"},
            },
            type: "object",
          },
        })
        .withResponse(503, {title: {type: "string"}})
        .build(),
    ],
    asyncHandler(async (req, res) => {
      if (!options.aiService) {
        throw new APIError({status: 503, title: "AIService is not configured for observability"});
      }
      const input =
        typeof req.body?.input === "string" && req.body.input.length > 0
          ? req.body.input
          : "Terreno observability multi-stage smoke test.";
      const userId = (req.user as {_id?: mongoose.Types.ObjectId} | undefined)?._id;

      const result = await runTestMultiStageWorkflow({
        aiService: options.aiService,
        exportTrace: options.exportTrace,
        input,
        userId,
      });

      return res.json({data: result});
    })
  );
};
