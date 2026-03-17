import {APIError, asyncHandler, authenticateMiddleware} from "@terreno/api";
import type express from "express";

import {getLangfuseClient} from "./langfuseClient";
import {requireAdmin} from "./langfuseRoutesMiddleware";
import type {ScoreSubmission, ScoringFunction} from "./langfuseTypes";

export const addEvaluationRoutes = (
  router: express.Application,
  basePath: string,
  scoringFunctions: ScoringFunction[] = []
): void => {
  router.get(
    `${basePath}/evaluations/config`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (_req, res) => {
      return res.json({scoringFunctions});
    })
  );

  router.post(
    `${basePath}/evaluations`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (req, res) => {
      const {traceId, name, value, comment, dataType} = req.body as ScoreSubmission;

      if (!traceId || !name || value === undefined) {
        throw new APIError({
          detail: "traceId, name, and value are required",
          status: 400,
          title: "Invalid request",
        });
      }

      const client = getLangfuseClient();
      client.score({
        comment: comment ?? null,
        dataType: dataType as "NUMERIC" | "CATEGORICAL" | "BOOLEAN" | undefined,
        name,
        traceId,
        value,
      });

      await client.flushAsync();
      return res.status(201).json({comment, dataType, name, traceId, value});
    })
  );
};
