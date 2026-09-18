import "./instrument";

import {logger} from "@terreno/api";

import {bootstrapJobsWorker} from "./jobs/bootstrapJobsWorker";

export const runStandaloneJobsWorker = async ({
  bootstrap = bootstrapJobsWorker,
  exitProcess = (code: number): void => {
    process.exit(code);
  },
}: {
  bootstrap?: typeof bootstrapJobsWorker;
  exitProcess?: (code: number) => void;
} = {}): Promise<void> => {
  try {
    await bootstrap();
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`[jobs-worker] Failed to start: ${detail}`);
    exitProcess(1);
  }
};

if (import.meta.main) {
  void runStandaloneJobsWorker();
}
