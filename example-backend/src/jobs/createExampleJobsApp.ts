import type {AnyTerrenoAccess} from "@terreno/api";
import {JobsApp, MongoJobRunner} from "@terreno/jobs";

import {defineExampleJobs} from "./defineExampleJobs";

export interface CreateExampleJobsAppOptions {
  accessControl?: AnyTerrenoAccess;
  pollIntervalMs?: number;
}

/** One shared JobsApp for the example API and `jobs:worker` standalone process. */
export const createExampleJobsApp = (options?: CreateExampleJobsAppOptions): JobsApp => {
  const jobsApp = new JobsApp({
    accessControl: options?.accessControl,
    pollIntervalMs: options?.pollIntervalMs,
    runner: new MongoJobRunner(),
    timezone: "UTC",
  });
  defineExampleJobs(jobsApp);
  return jobsApp;
};
