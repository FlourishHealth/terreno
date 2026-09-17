import {beforeEach, describe, it} from "bun:test";
import {TerrenoApp, type UserModel as UserModelType} from "@terreno/api";
import {setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";

import {JobsApp} from "../jobsApp";
import {getJobsService} from "../jobsService";
import {Job} from "../models/job";

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

const registerJobsApp = (jobsApp: JobsApp): void => {
  new TerrenoApp({
    skipListen: true,
    userModel: typedUserModel,
  })
    .register(jobsApp)
    .build();
};

describe("jobs delayed runAt and idempotency", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
    await Job.syncIndexes();
  });

  it("does not claim a job before runAt while the worker is running", async (): Promise<void> => {
    let handlerRuns = 0;
    const futureRunAt = DateTime.utc().plus({minutes: 5});

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("delayed-job", {
      handler: async () => {
        handlerRuns += 1;
      },
    });
    registerJobsApp(jobsApp);

    const enqueued = await getJobsService().enqueue({
      name: "delayed-job",
      payload: {marker: "future"},
      runAt: futureRunAt.toJSDate(),
    });

    assert.equal(enqueued.status, "pending");
    assert.equal(
      DateTime.fromJSDate(enqueued.runAt).toMillis(),
      futureRunAt.toMillis(),
      "enqueue stores the requested runAt"
    );

    await jobsApp.startWorker();
    let idlePolls = 0;
    await waitUntil(async () => {
      idlePolls += 1;
      const row = await Job.findExactlyOne({_id: enqueued._id});
      return idlePolls >= 6 && row.status === "pending";
    });
    await jobsApp.stopWorker();

    assert.equal(handlerRuns, 0);
    const stillPending = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(stillPending.status, "pending");
    assert.isUndefined(stillPending.lockedAt);
    assert.isUndefined(stillPending.lockedBy);
  });

  it("runs a delayed job once runAt is reached", async (): Promise<void> => {
    let handlerRuns = 0;
    const futureRunAt = DateTime.utc().plus({minutes: 5});

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("delayed-then-run", {
      handler: async () => {
        handlerRuns += 1;
      },
    });
    registerJobsApp(jobsApp);

    const enqueued = await getJobsService().enqueue({
      name: "delayed-then-run",
      payload: {},
      runAt: futureRunAt.toJSDate(),
    });

    await jobsApp.startWorker();
    let idlePolls = 0;
    await waitUntil(async () => {
      idlePolls += 1;
      const row = await Job.findExactlyOne({_id: enqueued._id});
      return idlePolls >= 4 && row.status === "pending";
    });

    await Job.updateOne({_id: enqueued._id}, {$set: {runAt: DateTime.utc().toJSDate()}});
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "completed"
    );
    await jobsApp.stopWorker();

    assert.equal(handlerRuns, 1);
  });

  it("returns the existing job for duplicate enqueue with the same name and idempotencyKey", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("idempotent-job", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    const first = await getJobsService().enqueue({
      idempotencyKey: "welcome-email:user-1",
      name: "idempotent-job",
      payload: {userId: "user-1"},
    });
    const second = await getJobsService().enqueue({
      idempotencyKey: "welcome-email:user-1",
      name: "idempotent-job",
      payload: {extra: "ignored", userId: "user-1"},
    });

    assert.equal(second._id.toString(), first._id.toString());
    assert.equal(await Job.countDocuments({name: "idempotent-job"}), 1);

    const stored = await Job.findExactlyOne({_id: first._id});
    assert.deepEqual(stored.payload, {userId: "user-1"});
    assert.equal(stored.idempotencyKey, "welcome-email:user-1");
  });

  it("deduplicates concurrent enqueues that share an idempotencyKey", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("race-idempotent", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    const results = await Promise.all(
      Array.from({length: 12}, () =>
        getJobsService().enqueue({
          idempotencyKey: "invoice:42",
          name: "race-idempotent",
          payload: {invoiceId: "42"},
        })
      )
    );

    const uniqueIds = new Set(results.map((job) => job._id.toString()));
    assert.equal(uniqueIds.size, 1);
    assert.equal(await Job.countDocuments({name: "race-idempotent"}), 1);
  });

  it("allows multiple jobs without an idempotencyKey for the same name", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("repeatable-job", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    const first = await getJobsService().enqueue({
      name: "repeatable-job",
      payload: {n: 1},
    });
    const second = await getJobsService().enqueue({
      name: "repeatable-job",
      payload: {n: 2},
    });

    assert.notEqual(second._id.toString(), first._id.toString());
    assert.equal(await Job.countDocuments({name: "repeatable-job"}), 2);
  });

  it("enforces unique (name, idempotencyKey) at the database level", async (): Promise<void> => {
    await Job.create({
      attemptCount: 0,
      idempotencyKey: "shared-key",
      maxAttempts: 5,
      name: "db-unique",
      payload: {},
      payloadRedacted: false,
      runAt: DateTime.utc().toJSDate(),
      status: "pending",
    });

    let caught: unknown;
    try {
      await Job.create({
        attemptCount: 0,
        idempotencyKey: "shared-key",
        maxAttempts: 5,
        name: "db-unique",
        payload: {duplicate: true},
        payloadRedacted: false,
        runAt: DateTime.utc().toJSDate(),
        status: "pending",
      });
    } catch (error: unknown) {
      caught = error;
    }

    assert.isDefined(caught);
    assert.equal((caught as {code?: number}).code, 11_000);
    assert.equal(await Job.countDocuments({name: "db-unique"}), 1);
  });

  it("executes an idempotent job only once when enqueue is retried", async (): Promise<void> => {
    let handlerRuns = 0;

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("idempotent-once", {
      handler: async () => {
        handlerRuns += 1;
      },
    });
    registerJobsApp(jobsApp);

    const first = await getJobsService().enqueue({
      idempotencyKey: "sync:user-9",
      name: "idempotent-once",
      payload: {},
    });
    await getJobsService().enqueue({
      idempotencyKey: "sync:user-9",
      name: "idempotent-once",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: first._id})).status === "completed"
    );
    await jobsApp.stopWorker();

    assert.equal(handlerRuns, 1);
    assert.equal(await Job.countDocuments({name: "idempotent-once"}), 1);
  });
});
