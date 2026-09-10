import "./instrument";

import {logger} from "@terreno/api";

import {bootstrapJobsWorker} from "./jobs/bootstrapJobsWorker";

if (import.meta.main) {
  void bootstrapJobsWorker().catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`[jobs-worker] Failed to start: ${detail}`);
    process.exit(1);
  });
}
