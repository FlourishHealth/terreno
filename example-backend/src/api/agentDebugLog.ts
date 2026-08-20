import {appendFileSync, mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {asyncHandler} from "@terreno/api";
import type express from "express";

const DEBUG_LOG_PATH = "/opt/cursor/logs/debug.log";

/** Dev-only ingest for agent runtime instrumentation (Playwright / syncdb debugging). */
export const addAgentDebugLogRoutes = (router: express.Router): void => {
  router.post(
    "/__agent_debug_log",
    asyncHandler(async (req, res) => {
      const payload = {
        ...(typeof req.body === "object" && req.body !== null ? req.body : {body: req.body}),
        timestamp: Date.now(),
      };
      try {
        mkdirSync(dirname(DEBUG_LOG_PATH), {recursive: true});
        appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify(payload)}\n`);
      } catch {
        // Best-effort only — never break the app under test.
      }
      return res.status(204).end();
    })
  );
};
