import {logger} from "@terreno/api";
import type {JobsApp} from "@terreno/jobs";

let shutdownHooksRegistered = false;

/** Stops the jobs poll loop on SIGTERM/SIGINT (idempotent hook registration). */
export const registerJobsWorkerShutdown = (jobsApp: JobsApp): void => {
  if (shutdownHooksRegistered) {
    return;
  }
  shutdownHooksRegistered = true;

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[jobs] Received ${signal}, stopping worker`);
    try {
      await jobsApp.stopWorker();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error(`[jobs] Worker shutdown failed: ${detail}`);
    }
  };

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
};
