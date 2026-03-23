import {asyncHandler, authenticateMiddleware} from "@terreno/api";
import type express from "express";

import {getLangfuseClient} from "./langfuseClient";
import {requireAdmin} from "./langfuseRoutesMiddleware";

export const addTraceRoutes = (router: express.Application, basePath: string): void => {
  router.get(
    `${basePath}/traces`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (req, res) => {
      const client = getLangfuseClient();
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const userId = req.query.userId as string | undefined;
      const fromTimestamp = req.query.from ? new Date(req.query.from as string) : undefined;
      const toTimestamp = req.query.to ? new Date(req.query.to as string) : undefined;

      const result = await client.fetchTraces({
        fromTimestamp,
        limit,
        page,
        toTimestamp,
        userId,
      });

      return res.json({data: result.data, meta: result.meta});
    })
  );

  router.get(
    `${basePath}/traces/:traceId`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (req, res) => {
      const client = getLangfuseClient();
      const result = await client.fetchTrace(req.params.traceId);
      return res.json(result.data);
    })
  );
};
