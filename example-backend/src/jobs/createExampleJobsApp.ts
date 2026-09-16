import {defineAdminScriptJob} from "@terreno/admin-backend";
import type {AnyTerrenoAccess} from "@terreno/api";
import {JobsApp} from "@terreno/jobs";

import {adminScripts} from "../adminScripts";
import {
  type CreateExampleJobsRuntimeOptions,
  createExampleJobsRuntime,
} from "./createExampleJobsRuntime";
import {defineExampleJobs} from "./defineExampleJobs";

export interface CreateExampleJobsAppOptions extends CreateExampleJobsRuntimeOptions {
  accessControl?: AnyTerrenoAccess;
  pollIntervalMs?: number;
}

/** One shared JobsApp for the example API and `jobs:worker` standalone process. */
export const createExampleJobsApp = (options?: CreateExampleJobsAppOptions): JobsApp => {
  const runtime = createExampleJobsRuntime(options);
  const jobsApp = new JobsApp({
    accessControl: options?.accessControl,
    executeAuth: runtime.executeAuth,
    pollIntervalMs: options?.pollIntervalMs,
    runner: runtime.runner,
    timezone: "UTC",
  });
  defineExampleJobs(jobsApp);
  defineAdminScriptJob(jobsApp, (name) => adminScripts.find((script) => script.name === name));
  return jobsApp;
};
