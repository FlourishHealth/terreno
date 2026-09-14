import {beforeEach, describe, expect, it} from "bun:test";
import {TerrenoApp, type UserModel as UserModelType} from "@terreno/api";
import {setupDb, UserModel} from "@terreno/api/testing";

import {JobsApp} from "../jobsApp";
import {Job} from "../models/job";
import {JobSchedule} from "../models/jobSchedule";

const typedUserModel = UserModel as unknown as UserModelType;

describe("JobsApp", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
    await JobSchedule.deleteMany({});
  });
  it("registers with TerrenoApp and builds without starting a worker", () => {
    const jobsApp = new JobsApp();

    const expressApp = new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    expect(expressApp).toBeDefined();
    expect(jobsApp.isWorkerActive()).toBe(false);
  });

  it("uses the configured base path", () => {
    expect(new JobsApp({basePath: "/background"}).getBasePath()).toBe("/background");
    expect(new JobsApp().getBasePath()).toBe("/jobs");
  });

  it("starts and stops a worker only when explicitly requested", async () => {
    const jobsApp = new JobsApp({pollIntervalMs: 50});

    expect(jobsApp.isWorkerActive()).toBe(false);
    await jobsApp.startWorker();
    expect(jobsApp.isWorkerActive()).toBe(true);
    await jobsApp.startWorker();
    expect(jobsApp.isWorkerActive()).toBe(true);
    await jobsApp.stopWorker();
    expect(jobsApp.isWorkerActive()).toBe(false);
    await jobsApp.stopWorker();
    expect(jobsApp.isWorkerActive()).toBe(false);
  });

  it("exposes defaults, executes queued jobs, and marks schedules dirty while a worker is active", async () => {
    const jobsApp = new JobsApp({lockTtlMs: 60_000, pollIntervalMs: 50});
    jobsApp.define("taste/defaults", {
      handler: async () => {},
    });

    expect(jobsApp.getDefaultTimezone()).toBe("UTC");
    expect(jobsApp.getLockTtlMs()).toBe(60_000);
    expect(jobsApp.getPollIntervalMs()).toBe(50);
    expect(new JobsApp().getPollIntervalMs()).toBe(1_000);

    await jobsApp.startWorker();
    jobsApp.define("taste/heartbeat", {
      handler: async () => {},
      schedule: {cron: "*/5 * * * *", timezone: "UTC"},
    });
    await jobsApp.reconcileSchedulesIfDirty();

    const missing = await jobsApp.executeQueuedJob("000000000000000000000000");
    expect(missing.kind).toBe("not_found");
    await jobsApp.stopWorker();
  });

  it("logs when Job or JobSchedule index builds fail during register", async () => {
    const jobsApp = new JobsApp();
    const originalJobInit = Job.init.bind(Job);
    const originalScheduleInit = JobSchedule.init.bind(JobSchedule);
    Job.init = (async () => {
      throw new Error("job index failed");
    }) as typeof Job.init;
    JobSchedule.init = (async () => {
      throw "schedule index failed";
    }) as typeof JobSchedule.init;

    try {
      new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      })
        .register(jobsApp)
        .build();
      await Bun.sleep(20);
    } finally {
      Job.init = originalJobInit;
      JobSchedule.init = originalScheduleInit;
    }
  });
});
