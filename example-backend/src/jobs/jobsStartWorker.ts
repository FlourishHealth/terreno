import {logger} from "@terreno/api";

/**
 * Parses `JOBS_START_WORKER`. Unset defaults to `true` for local example convenience;
 * set `false` when running `bun run jobs:worker` as a dedicated worker process.
 */
export const parseJobsStartWorkerEnv = (value: string | undefined): boolean => {
  if (value === undefined || value.trim() === "") {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  logger.warn(
    `[jobs] Invalid JOBS_START_WORKER="${value}"; expected true or false. Defaulting to true.`
  );
  return true;
};

export const shouldStartJobsWorkerInApiProcess = ({
  jobsStartWorkerEnv,
  skipListen,
}: {
  jobsStartWorkerEnv?: string;
  skipListen: boolean;
}): boolean => {
  if (skipListen) {
    return false;
  }

  return parseJobsStartWorkerEnv(jobsStartWorkerEnv);
};
