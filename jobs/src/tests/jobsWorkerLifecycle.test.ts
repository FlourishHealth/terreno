import {beforeEach, describe, it} from "bun:test";
import os from "node:os";
import {TerrenoApp, type UserModel as UserModelType} from "@terreno/api";
import {setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";

import {JobsApp} from "../jobsApp";
import {getJobsService} from "../jobsService";
import {Job} from "../models/job";
import {getWorkerId} from "../runners/mongoRunner";

const typedUserModel = UserModel as unknown as UserModelType;

const waitUntil = async (
  predicate: () => Promise<boolean>,
  options?: {intervalMs?: number; timeoutMs?: number}
): Promise<void> => {
  const intervalMs = options?.intervalMs ?? 25;
  const timeoutMs = options?.timeoutMs ?? 5_000;
  const deadline = DateTime.utc().plus({milliseconds: timeoutMs});

  while (DateTime.utc() < deadline) {
    if (await predicate()) {
      return;
    }
    await Bun.sleep(intervalMs);
  }

  throw new Error("waitUntil timed out");
};

describe("jobs worker lifecycle", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
  });

  it("does not poll until startWorker is called", async (): Promise<void> => {
    const jobsApp = new JobsApp({pollIntervalMs: 50});
    jobsApp.define("idle-check", {
      handler: async () => {},
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "idle-check",
      payload: {},
    });

    assert.equal(jobsApp.isWorkerActive(), false);

    let pendingChecks = 0;
    await waitUntil(async () => {
      pendingChecks += 1;
      const row = await Job.findExactlyOne({_id: enqueued._id});
      return pendingChecks >= 3 && row.status === "pending";
    });

    const stillPending = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(stillPending.status, "pending");
  });

  it("reclaims a running job when lockedAt exceeds lockTtlMs", async (): Promise<void> => {
    let executionCount = 0;

    const jobsApp = new JobsApp({lockTtlMs: 100, pollIntervalMs: 25});
    jobsApp.define("reclaim-me", {
      handler: async () => {
        executionCount += 1;
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const staleJob = await Job.create({
      attemptCount: 0,
      lockedAt: DateTime.utc().minus({milliseconds: 500}).toJSDate(),
      lockedBy: "dead-worker:99999",
      maxAttempts: 5,
      name: "reclaim-me",
      payload: {},
      payloadRedacted: false,
      runAt: DateTime.utc().minus({milliseconds: 500}).toJSDate(),
      status: "running",
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: staleJob._id})).status === "completed"
    );
    await jobsApp.stopWorker();

    assert.equal(executionCount, 1);
    const reclaimed = await Job.findExactlyOne({_id: staleJob._id});
    assert.equal(reclaimed.status, "completed");
    assert.equal(reclaimed.lockedBy, getWorkerId());
  });

  it("executes a reclaimed job exactly once when two workers race", async (): Promise<void> => {
    let executionCount = 0;

    const workerA = new JobsApp({pollIntervalMs: 25});
    const workerB = new JobsApp({pollIntervalMs: 25});
    const handler = async (): Promise<void> => {
      executionCount += 1;
      await Bun.sleep(50);
    };

    workerA.define("race-once", {handler});
    workerB.define("race-once", {handler});

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(workerA)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "race-once",
      payload: {},
    });

    await Promise.all([workerA.startWorker(), workerB.startWorker()]);
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "completed"
    );
    await Promise.all([workerA.stopWorker(), workerB.stopWorker()]);

    assert.equal(executionCount, 1);
  });

  it("records hostname and pid in lockedBy when claiming", async (): Promise<void> => {
    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("lock-identity", {
      handler: async () => {},
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "lock-identity",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "completed"
    );
    await jobsApp.stopWorker();

    const completed = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(completed.lockedBy, `${os.hostname()}:${process.pid}`);
  });

  it("stopWorker aborts the poll loop and resolves cleanly", async (): Promise<void> => {
    const jobsApp = new JobsApp({pollIntervalMs: 50});
    jobsApp.define("stop-check", {
      handler: async () => {},
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    await jobsApp.startWorker();
    assert.isTrue(jobsApp.isWorkerActive());

    await jobsApp.stopWorker();
    assert.isFalse(jobsApp.isWorkerActive());

    await jobsApp.stopWorker();
    assert.isFalse(jobsApp.isWorkerActive());
  });

  it("stopWorker aborts an in-flight handler via ctx.signal", async (): Promise<void> => {
    let sawAbort = false;

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("slow-job", {
      handler: async (_payload, ctx) => {
        await waitUntil(() => Promise.resolve(ctx.signal.aborted), {
          intervalMs: 25,
          timeoutMs: 5_000,
        });
        sawAbort = ctx.signal.aborted;
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "slow-job",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "running"
    );
    await jobsApp.stopWorker();
    await waitUntil(() => Promise.resolve(sawAbort));

    assert.isTrue(sawAbort);
    assert.isFalse(jobsApp.isWorkerActive());

    const completed = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(completed.status, "completed");
  });

  it("persists completed when the handler finishes after stopWorker aborts", async (): Promise<void> => {
    let handlerStarted = false;
    let handlerFinished = false;

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("finish-after-abort", {
      handler: async (_payload, ctx) => {
        handlerStarted = true;
        await waitUntil(() => Promise.resolve(ctx.signal.aborted));
        handlerFinished = true;
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "finish-after-abort",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(() => Promise.resolve(handlerStarted));
    const stopPromise = jobsApp.stopWorker();
    await waitUntil(() => Promise.resolve(handlerFinished));
    await stopPromise;

    const completed = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(completed.status, "completed");
    assert.isDefined(completed.lockedBy);
  });

  it("requeues and unlocks when abort throws in-flight work", async (): Promise<void> => {
    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("abort-throw", {
      handler: async (_payload, ctx) => {
        await waitUntil(() => Promise.resolve(ctx.signal.aborted));
        throw new Error("worker shutdown");
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "abort-throw",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "running"
    );
    await jobsApp.stopWorker();
    await waitUntil(async () => {
      const row = await Job.findExactlyOne({_id: enqueued._id});
      return row.status === "pending" && row.lockedAt == null && row.lockedBy == null;
    });
  });

  it("restarts a pending job on a later startWorker after stopWorker", async (): Promise<void> => {
    let handlerRuns = 0;
    let throwOnAbort = true;

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("restart-me", {
      handler: async (_payload, ctx) => {
        handlerRuns += 1;
        if (throwOnAbort) {
          await waitUntil(() => Promise.resolve(ctx.signal.aborted));
          throw new Error("worker shutdown");
        }
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "restart-me",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "running"
    );
    await jobsApp.stopWorker();
    await waitUntil(async () => {
      const row = await Job.findExactlyOne({_id: enqueued._id});
      return row.status === "pending" && row.lockedAt == null && row.lockedBy == null;
    });

    throwOnAbort = false;
    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "completed"
    );
    await jobsApp.stopWorker();

    assert.equal(handlerRuns, 2);
  });

  it("does not rerun a job that completed during stopWorker", async (): Promise<void> => {
    let handlerRuns = 0;

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("complete-once", {
      handler: async (_payload, ctx) => {
        handlerRuns += 1;
        await waitUntil(() => Promise.resolve(ctx.signal.aborted));
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "complete-once",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "running"
    );
    await jobsApp.stopWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "completed"
    );

    await jobsApp.startWorker();
    let idlePolls = 0;
    await waitUntil(async () => {
      idlePolls += 1;
      return idlePolls >= 5;
    });
    await jobsApp.stopWorker();

    assert.equal(handlerRuns, 1);
  });

  it("startWorker returns without awaiting the poll loop", async (): Promise<void> => {
    let handlerStarted = false;
    let releaseHandler!: () => void;
    const handlerBlocked = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("async-start", {
      handler: async () => {
        handlerStarted = true;
        await handlerBlocked;
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "async-start",
      payload: {},
    });

    await jobsApp.startWorker();
    assert.isTrue(jobsApp.isWorkerActive());
    assert.isFalse(handlerStarted);

    await waitUntil(() => Promise.resolve(handlerStarted));
    releaseHandler();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "completed"
    );
    await jobsApp.stopWorker();
  });

  it("startWorker rejects runners that do not implement start", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      runner: {
        enqueue: async () => {},
        id: "noop",
      },
    });

    try {
      await jobsApp.startWorker();
      assert.fail("expected startWorker to throw");
    } catch (error: unknown) {
      assert.match(String(error), /does not support start/);
    }

    assert.isFalse(jobsApp.isWorkerActive());
  });

  it("resets worker state when the runner start promise rejects", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      runner: {
        enqueue: async () => {},
        id: "broken",
        start: async () => {
          throw new Error("start failed");
        },
      },
    });

    await jobsApp.startWorker();
    await waitUntil(() => Promise.resolve(!jobsApp.isWorkerActive()));

    assert.isFalse(jobsApp.isWorkerActive());
  });

  it("marks handler failures as failed without stopping the worker", async (): Promise<void> => {
    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("boom", {
      handler: async () => {
        throw new Error("handler exploded");
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "boom",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "failed"
    );
    assert.isTrue(jobsApp.isWorkerActive());
    await jobsApp.stopWorker();

    const failed = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(failed.status, "failed");
    assert.match(failed.lastError ?? "", /handler exploded/);
  });
});
