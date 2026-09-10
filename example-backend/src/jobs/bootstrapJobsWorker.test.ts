import {beforeEach, describe, it} from "bun:test";
import type {UserModel as TerrenoAuthUserModel} from "@terreno/api";
import {Job, JobSchedule} from "@terreno/jobs";
import {assert} from "chai";

import {access} from "../access";
import {User} from "../models/user";
import {bootstrapJobsWorker} from "./bootstrapJobsWorker";
import {createExampleJobsApp} from "./createExampleJobsApp";

const typedUserModel = User as unknown as TerrenoAuthUserModel;

describe("bootstrapJobsWorker", () => {
  beforeEach(async (): Promise<void> => {
    await Job.deleteMany({});
    await JobSchedule.deleteMany({});
  });

  it("builds skipListen without HTTP and starts the worker after Mongo connects", async (): Promise<void> => {
    let mongoConnected = false;
    let workerStarted = false;
    let shutdownRegistered = false;
    let exitCode: number | undefined;

    const jobsApp = createExampleJobsApp({accessControl: access, pollIntervalMs: 50});
    const originalStartWorker = jobsApp.startWorker.bind(jobsApp);
    jobsApp.startWorker = async () => {
      workerStarted = true;
      await originalStartWorker();
    };

    const {jobsApp: startedJobsApp, terrenoApp} = await bootstrapJobsWorker({
      connectMongo: async () => {
        mongoConnected = true;
      },
      createJobsApp: () => jobsApp,
      disconnectMongo: async () => {},
      exitProcess: (code) => {
        exitCode = code;
      },
      registerProcessShutdown: () => {
        shutdownRegistered = true;
      },
      seedRoles: async () => {},
      shutdownConfiguration: async () => {},
      userModel: typedUserModel,
    });

    assert.isTrue(mongoConnected);
    assert.isTrue(workerStarted);
    assert.isTrue(shutdownRegistered);
    assert.isTrue(startedJobsApp.isWorkerActive());
    assert.equal(exitCode, undefined);
    assert.equal(terrenoApp.getPlugins().length, 1);

    await startedJobsApp.stopWorker();
  });
});
