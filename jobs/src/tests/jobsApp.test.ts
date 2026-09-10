import {beforeEach, describe, expect, it} from "bun:test";
import {TerrenoApp, type UserModel as UserModelType} from "@terreno/api";
import {setupDb, UserModel} from "@terreno/api/testing";

import {JobsApp} from "../jobsApp";
import {Job} from "../models/job";

const typedUserModel = UserModel as unknown as UserModelType;

describe("JobsApp", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
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
    const jobsApp = new JobsApp();

    expect(jobsApp.isWorkerActive()).toBe(false);
    await jobsApp.startWorker();
    expect(jobsApp.isWorkerActive()).toBe(true);
    await jobsApp.stopWorker();
    expect(jobsApp.isWorkerActive()).toBe(false);
  });
});
