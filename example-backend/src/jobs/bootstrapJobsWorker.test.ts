import {beforeEach, describe, it} from "bun:test";
import type {UserModel as TerrenoAuthUserModel} from "@terreno/api";
import {Job, JobSchedule} from "@terreno/jobs";
import {assert} from "chai";
import mongoose from "mongoose";

import {access} from "../access";
import {Configuration} from "../models/configuration";
import {User} from "../models/user";
import {bootstrapJobsWorker} from "./bootstrapJobsWorker";
import {createExampleJobsApp} from "./createExampleJobsApp";
import {resetJobsWorkerShutdownHooks} from "./shutdownJobsWorker";

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

  it("runs the registered shutdown callback to stop the worker and exit 0", async (): Promise<void> => {
    let capturedShutdown: (() => Promise<void>) | undefined;
    let disconnected = false;
    let configShutdown = false;
    let exitCode: number | undefined;

    const jobsApp = createExampleJobsApp({accessControl: access, pollIntervalMs: 50});

    const {jobsApp: startedJobsApp} = await bootstrapJobsWorker({
      connectMongo: async () => {},
      createJobsApp: () => jobsApp,
      disconnectMongo: async () => {
        disconnected = true;
      },
      exitProcess: (code) => {
        exitCode = code;
      },
      registerProcessShutdown: (_jobsApp, onShutdown) => {
        capturedShutdown = onShutdown;
      },
      seedRoles: async () => {},
      shutdownConfiguration: async () => {
        configShutdown = true;
      },
      userModel: typedUserModel,
    });

    assert.isDefined(capturedShutdown);
    await capturedShutdown?.();
    assert.isTrue(configShutdown);
    assert.isTrue(disconnected);
    assert.equal(exitCode, 0);
    assert.isFalse(startedJobsApp.isWorkerActive());
  });

  it("uses default process shutdown, mongo disconnect, and exit hooks", async (): Promise<void> => {
    const attached: Array<{event: string; listener: () => void}> = [];
    const originalOnce = process.once.bind(process);
    const originalExit = process.exit.bind(process);
    const originalDisconnect = mongoose.disconnect.bind(mongoose);
    const originalConfigShutdown = Configuration.shutdown.bind(Configuration);
    let disconnected = false;
    let configShutdown = false;
    let exitCode: number | undefined;

    process.once = ((event: string, listener: () => void) => {
      attached.push({event, listener});
      return process;
    }) as typeof process.once;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      return undefined as never;
    }) as typeof process.exit;
    mongoose.disconnect = (async () => {
      disconnected = true;
    }) as typeof mongoose.disconnect;
    Configuration.shutdown = (async () => {
      configShutdown = true;
    }) as typeof Configuration.shutdown;

    const jobsApp = createExampleJobsApp({accessControl: access, pollIntervalMs: 50});

    try {
      const {jobsApp: startedJobsApp} = await bootstrapJobsWorker({
        connectMongo: async () => {},
        createJobsApp: () => jobsApp,
        userModel: typedUserModel,
      });

      assert.include(
        attached.map((entry) => entry.event),
        "SIGTERM"
      );
      const shutdownTerm = [...attached].reverse().find((entry) => entry.event === "SIGTERM");
      const shutdownInt = [...attached].reverse().find((entry) => entry.event === "SIGINT");
      shutdownTerm?.listener();
      await Bun.sleep(20);
      shutdownInt?.listener();
      await Bun.sleep(20);
      assert.isTrue(disconnected);
      assert.isTrue(configShutdown);
      assert.equal(exitCode, 0);
      assert.isFalse(startedJobsApp.isWorkerActive());
    } finally {
      process.once = originalOnce;
      process.exit = originalExit;
      mongoose.disconnect = originalDisconnect;
      Configuration.shutdown = originalConfigShutdown;
      resetJobsWorkerShutdownHooks();
    }
  });
});
