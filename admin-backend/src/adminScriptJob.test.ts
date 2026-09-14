import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  BackgroundTask,
  createScriptArgs,
  setupAuth,
  type UserModel as UserModelType,
} from "@terreno/api";
import {getBaseServer, setupDb, UserModel} from "@terreno/api/testing";
import {Job, JobsApp, unregisterJobsService} from "@terreno/jobs";

import {
  ADMIN_SCRIPT_JOB_NAME,
  defineAdminScriptJob,
  parseAdminScriptJobPayload,
  runRegisteredScriptTask,
  tryCancelAdminScriptJob,
  tryEnqueueAdminScriptJob,
} from "./adminScriptJob";

const echoScript = {
  description: "Echo",
  name: "echo",
  runner: async (wetRun: boolean) => ({
    results: [wetRun ? "wet" : "dry"],
    success: true,
  }),
};

describe("admin/script durable job adapter", () => {
  beforeEach(async () => {
    await setupDb();
    await BackgroundTask.deleteMany({});
    await Job.deleteMany({});
    unregisterJobsService();
  });

  afterEach(async () => {
    unregisterJobsService();
  });

  it("parses a valid payload and rejects malformed ones", () => {
    expect(
      parseAdminScriptJobPayload({
        args: {model: "todos"},
        createdByName: "Ada",
        scriptName: "echo",
        taskId: "abc",
        wetRun: false,
      })
    ).toEqual({
      args: {model: "todos"},
      createdByName: "Ada",
      scriptName: "echo",
      taskId: "abc",
      wetRun: false,
    });
    expect(parseAdminScriptJobPayload(null)).toBeUndefined();
    expect(
      parseAdminScriptJobPayload({
        scriptName: "echo",
        taskId: "abc",
        wetRun: false,
      })?.args
    ).toEqual({});
    expect(parseAdminScriptJobPayload({scriptName: "echo"})).toBeUndefined();
    expect(
      parseAdminScriptJobPayload({
        args: {bad: {nested: true}},
        scriptName: "echo",
        taskId: "abc",
        wetRun: true,
      })
    ).toBeUndefined();
  });

  it("does not enqueue when JobsApp is unregistered", async () => {
    const enqueued = await tryEnqueueAdminScriptJob({
      args: {},
      scriptName: "echo",
      taskId: "000000000000000000000001",
      wetRun: false,
    });
    expect(enqueued).toBeUndefined();
  });

  it("runs a script against a BackgroundTask row", async () => {
    const task = await BackgroundTask.create({
      isDryRun: true,
      logs: [],
      status: "pending",
      taskType: "echo",
    });
    const {args} = createScriptArgs({values: {}});
    await runRegisteredScriptTask({
      args,
      script: echoScript,
      taskId: String(task._id),
      wetRun: false,
    });
    const refreshed = await BackgroundTask.findById(task._id);
    expect(refreshed?.status).toBe("completed");
    expect(refreshed?.result).toContain("dry");
  });

  it("enqueues admin/script with maxAttempts 1 and completes via executeQueuedJob", async () => {
    const jobsApp = new JobsApp({pollIntervalMs: 25});
    defineAdminScriptJob(jobsApp, (name) => (name === "echo" ? echoScript : undefined));
    const app = getBaseServer();
    setupAuth(app, UserModel as unknown as UserModelType);
    addAuthRoutes(app, UserModel as unknown as UserModelType);
    jobsApp.register(app);
    app.use(apiUnauthorizedMiddleware);
    app.use(apiErrorMiddleware);

    const task = await BackgroundTask.create({
      isDryRun: true,
      logs: [],
      status: "pending",
      taskType: "echo",
    });
    const enqueued = await tryEnqueueAdminScriptJob({
      args: {},
      scriptName: "echo",
      taskId: String(task._id),
      wetRun: false,
    });
    expect(enqueued).toBeDefined();
    const job = await Job.findById(enqueued?.id);
    expect(job?.name).toBe(ADMIN_SCRIPT_JOB_NAME);
    expect(job?.maxAttempts).toBe(1);

    const outcome = await jobsApp.executeQueuedJob(String(job?._id));
    expect(outcome.kind).toBe("executed");
    if (outcome.kind === "executed") {
      expect(outcome.job.lastError).toBeUndefined();
      expect(outcome.job.status).toBe("completed");
    }
    const current = await BackgroundTask.findById(task._id);
    expect(current?.status).toBe("completed");
    expect(current?.result).toContain("dry");
  });

  it("treats omitted args as empty and rejects empty script names", () => {
    expect(
      parseAdminScriptJobPayload({
        args: {tags: ["a", "b"]},
        scriptName: "echo",
        taskId: "abc",
        wetRun: true,
      })?.args
    ).toEqual({tags: ["a", "b"]});
    expect(
      parseAdminScriptJobPayload({
        args: [],
        scriptName: "echo",
        taskId: "abc",
        wetRun: true,
      })
    ).toBeUndefined();
    expect(
      parseAdminScriptJobPayload({scriptName: "", taskId: "abc", wetRun: true})
    ).toBeUndefined();
    expect(
      parseAdminScriptJobPayload({scriptName: "echo", taskId: "", wetRun: true})
    ).toBeUndefined();
    expect(
      parseAdminScriptJobPayload({scriptName: "echo", taskId: "abc", wetRun: "yes"})
    ).toBeUndefined();
  });

  it("marks the BackgroundTask cancelled when the job signal is aborted", async () => {
    const task = await BackgroundTask.create({
      isDryRun: true,
      logs: [],
      status: "pending",
      taskType: "echo",
    });
    const {args} = createScriptArgs({values: {}});
    const signal = AbortSignal.abort();
    await runRegisteredScriptTask({
      args,
      script: echoScript,
      signal,
      taskId: String(task._id),
      wetRun: false,
    });
    const refreshed = await BackgroundTask.findById(task._id);
    expect(refreshed?.status).toBe("cancelled");
  });

  it("fails the BackgroundTask when the script name is unknown", async () => {
    const jobsApp = new JobsApp({pollIntervalMs: 50});
    defineAdminScriptJob(jobsApp, () => undefined);
    const app = getBaseServer();
    jobsApp.register(app);
    const task = await BackgroundTask.create({
      isDryRun: true,
      logs: [],
      status: "pending",
      taskType: "missing",
    });
    const enqueued = await tryEnqueueAdminScriptJob({
      args: {model: "todos"},
      scriptName: "missing",
      taskId: String(task._id),
      wetRun: false,
    });
    const outcome = await jobsApp.executeQueuedJob(String(enqueued?.id));
    expect(outcome.kind).toBe("executed");
    const refreshed = await BackgroundTask.findById(task._id);
    expect(refreshed?.status).toBe("failed");
    expect(refreshed?.error).toInclude("Script not found");
  });

  it("cancels the matching job row for a script task", async () => {
    const jobsApp = new JobsApp({pollIntervalMs: 50});
    defineAdminScriptJob(jobsApp, (name) => (name === "echo" ? echoScript : undefined));
    const app = getBaseServer();
    jobsApp.register(app);

    const task = await BackgroundTask.create({
      isDryRun: true,
      logs: [],
      status: "pending",
      taskType: "echo",
    });
    const enqueued = await tryEnqueueAdminScriptJob({
      args: {},
      scriptName: "echo",
      taskId: String(task._id),
      wetRun: false,
    });
    await tryCancelAdminScriptJob(String(task._id));
    const job = await Job.findById(enqueued?.id);
    expect(job?.status).toBe("cancelled");
  });
});
