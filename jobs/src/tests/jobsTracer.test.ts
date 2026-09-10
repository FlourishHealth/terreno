import {beforeEach, describe, it} from "bun:test";
import {
  type APIError,
  getCurrentRequestContext,
  isAPIError,
  TerrenoApp,
  type UserModel as UserModelType,
} from "@terreno/api";
import {setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";
import {JobsApp} from "../jobsApp";
import {getJobsService} from "../jobsService";
import {Job} from "../models/job";
import {MongoJobRunner} from "../runners/mongoRunner";

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

const captureError = async (operation: () => Promise<unknown>): Promise<unknown> => {
  try {
    await operation();
    return undefined;
  } catch (error: unknown) {
    return error;
  }
};

describe("jobs tracer", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
  });

  it("enqueue then startWorker completes the job inside runWithRequestContext", async (): Promise<void> => {
    let seenPayload: unknown;
    let seenJobId: string | undefined;
    let contextJobId: string | undefined;

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("echo-payload", {
      handler: async (payload, ctx) => {
        seenPayload = payload;
        seenJobId = ctx.jobId;
        contextJobId = getCurrentRequestContext()?.jobId;
      },
    });

    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const enqueued = await getJobsService().enqueue({
      name: "echo-payload",
      payload: {value: "hello"},
    });

    assert.equal(enqueued.status, "pending");
    assert.deepEqual(enqueued.payload, {value: "hello"});
    assert.isAtMost(
      Math.abs(DateTime.fromJSDate(enqueued.runAt).toMillis() - DateTime.utc().toMillis()),
      5_000
    );

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({_id: enqueued._id})).status === "completed"
    );
    await jobsApp.stopWorker();

    const completed = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(completed.status, "completed");
    assert.deepEqual(seenPayload, {value: "hello"});
    assert.equal(seenJobId, enqueued._id.toString());
    assert.equal(contextJobId, enqueued._id.toString());
  });

  it("enqueue with an unknown job name throws APIError 400", async (): Promise<void> => {
    const jobsApp = new JobsApp({pollIntervalMs: 25});
    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const error = await captureError(() =>
      getJobsService().enqueue({
        name: "missing-handler",
        payload: {},
      })
    );

    assert.isTrue(isAPIError(error));
    assert.equal((error as APIError).status, 400);
    assert.equal(await Job.countDocuments(), 0);
  });

  it("fails loud when a pending row has no registered handler at execution time", async (): Promise<void> => {
    const jobsApp = new JobsApp({pollIntervalMs: 25});
    new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    await Job.create({
      attemptCount: 0,
      maxAttempts: 5,
      name: "orphan-job",
      payload: {},
      payloadRedacted: false,
      runAt: DateTime.utc().toJSDate(),
      status: "pending",
    });

    await jobsApp.startWorker();
    await waitUntil(
      async () => (await Job.findExactlyOne({name: "orphan-job"})).status === "failed"
    );
    await jobsApp.stopWorker();

    const failed = await Job.findExactlyOne({name: "orphan-job"});
    assert.equal(failed.status, "failed");
    assert.match(failed.lastError ?? "", /No handler registered/);
  });

  it("MongoJobRunner enqueue is a no-op after persistence", async (): Promise<void> => {
    const runner = new MongoJobRunner();
    const job = await Job.create({
      attemptCount: 0,
      maxAttempts: 5,
      name: "noop",
      payload: {},
      payloadRedacted: false,
      runAt: DateTime.utc().toJSDate(),
      status: "pending",
    });

    await runner.enqueue(job);
    assert.equal(await Job.countDocuments(), 1);
    await Job.deleteMany({name: "noop"});
  });
});
