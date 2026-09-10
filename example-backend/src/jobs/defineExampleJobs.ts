import {APIError} from "@terreno/api";
import type {JobsApp} from "@terreno/jobs";

/** Shared demo job catalog for the example API process and standalone worker entry. */
export const defineExampleJobs = (jobsApp: JobsApp): void => {
  jobsApp.define("example/log-message", {
    handler: async (payload, ctx) => {
      const message =
        typeof (payload as {message?: unknown})?.message === "string"
          ? (payload as {message: string}).message
          : "hello from example job";
      ctx.log.info(message);
    },
  });

  jobsApp.define("example/heartbeat", {
    handler: async (_payload, ctx) => {
      ctx.log.info("example heartbeat tick");
    },
    schedule: {
      cron: "*/5 * * * *",
      timezone: "UTC",
    },
  });

  jobsApp.define("example/dlq-demo", {
    handler: async (_payload, ctx) => {
      ctx.log.warn("intentional failure for dead-letter queue demonstration");
      throw new APIError({
        detail: "Use the enqueueDlqDemoJob admin script to demo dead-letter handling",
        status: 500,
        title: "Intentional DLQ demonstration failure",
      });
    },
    retry: {
      backoffMs: 100,
      maxAttempts: 2,
    },
  });
};
