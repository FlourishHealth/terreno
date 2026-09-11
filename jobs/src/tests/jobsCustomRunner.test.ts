import {beforeEach, describe, it} from "bun:test";
import {TerrenoApp, type UserModel as UserModelType} from "@terreno/api";
import {setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";
import {JobDispatchError} from "../dispatchError";
import {JobsApp} from "../jobsApp";
import {getJobsService} from "../jobsService";
import {Job} from "../models/job";
import {JobSchedule} from "../models/jobSchedule";
import type {JobDocument} from "../modelTypes";
import {buildScheduleRunIdempotencyKey, tickDueSchedules} from "../scheduler";
import type {JobRunner, JobRunnerStartOptions, JobsRunnerHost} from "../types";

const typedUserModel = UserModel as unknown as UserModelType;

class FakeJobRunner implements JobRunner {
  readonly id = "fake";
  readonly enqueuedJobs: JobDocument[] = [];
  readonly startCalls: JobRunnerStartOptions[] = [];
  stopCalls = 0;

  async enqueue(job: JobDocument): Promise<void> {
    this.enqueuedJobs.push(job);
  }

  async start(options: JobRunnerStartOptions): Promise<void> {
    this.startCalls.push(options);

    await new Promise<void>((resolve) => {
      if (options.signal.aborted) {
        resolve();
        return;
      }

      const onAbort = (): void => {
        options.signal.removeEventListener("abort", onAbort);
        resolve();
      };

      options.signal.addEventListener("abort", onAbort, {once: true});
    });
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
  }
}

const registerJobsApp = (jobsApp: JobsApp): void => {
  new TerrenoApp({
    skipListen: true,
    userModel: typedUserModel,
  })
    .register(jobsApp)
    .build();
};

const waitForAbort = async (signal: AbortSignal): Promise<void> => {
  await new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    signal.addEventListener("abort", () => resolve(), {once: true});
  });
};

class FailingThenSucceedingRunner implements JobRunner {
  readonly id = "fail-then-succeed";
  dispatchAttempts = 0;
  readonly enqueuedJobs: JobDocument[] = [];

  async enqueue(job: JobDocument): Promise<void> {
    this.dispatchAttempts += 1;
    if (this.dispatchAttempts === 1) {
      throw new Error("dispatch failed");
    }
    this.enqueuedJobs.push(job);
  }

  async start(options: JobRunnerStartOptions): Promise<void> {
    await waitForAbort(options.signal);
  }

  async stop(): Promise<void> {}
}

class CountingDispatchRunner implements JobRunner {
  readonly id = "count-dispatch";
  dispatchCount = 0;

  async enqueue(_job: JobDocument): Promise<void> {
    this.dispatchCount += 1;
  }

  async start(options: JobRunnerStartOptions): Promise<void> {
    await waitForAbort(options.signal);
  }

  async stop(): Promise<void> {}
}

describe("JobRunner custom runner seam", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
    await Job.syncIndexes();
  });

  it("calls runner.enqueue once per newly persisted job", async (): Promise<void> => {
    const fake = new FakeJobRunner();
    const jobsApp = new JobsApp({runner: fake});
    jobsApp.define("dispatch-me", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    const first = await getJobsService().enqueue({
      name: "dispatch-me",
      payload: {n: 1},
    });
    const second = await getJobsService().enqueue({
      name: "dispatch-me",
      payload: {n: 2},
    });

    assert.equal(fake.enqueuedJobs.length, 2);
    assert.sameMembers(
      fake.enqueuedJobs.map((job) => job._id.toString()),
      [first._id.toString(), second._id.toString()]
    );
  });

  it("does not call runner.enqueue when idempotent enqueue dedupes", async (): Promise<void> => {
    const fake = new FakeJobRunner();
    const jobsApp = new JobsApp({runner: fake});
    jobsApp.define("dedupe-dispatch", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    const first = await getJobsService().enqueue({
      idempotencyKey: "welcome:user-1",
      name: "dedupe-dispatch",
      payload: {userId: "user-1"},
    });
    const second = await getJobsService().enqueue({
      idempotencyKey: "welcome:user-1",
      name: "dedupe-dispatch",
      payload: {ignored: true},
    });

    assert.equal(second._id.toString(), first._id.toString());
    assert.equal(fake.enqueuedJobs.length, 1);
    assert.equal(fake.enqueuedJobs[0]._id.toString(), first._id.toString());
  });

  it("passes JobsRunnerHost context and lifecycle signal to runner.start", async (): Promise<void> => {
    const fake = new FakeJobRunner();
    const jobsApp = new JobsApp({pollIntervalMs: 321, runner: fake});
    jobsApp.define("start-context", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    await jobsApp.startWorker();

    assert.equal(fake.startCalls.length, 1);
    const startOptions = fake.startCalls[0];
    assert.equal(startOptions.pollIntervalMs, 321);
    assert.isFalse(startOptions.signal.aborted);

    const host: JobsRunnerHost = startOptions.jobs;
    assert.equal(host.getDefaultTimezone(), jobsApp.getDefaultTimezone());
    assert.isDefined(host.getDefinition("start-context"));
    assert.isAbove(host.getLockTtlMs(), 0);

    await jobsApp.stopWorker();

    assert.isTrue(startOptions.signal.aborted);
    assert.equal(fake.stopCalls, 1);
    assert.isFalse(jobsApp.isWorkerActive());
  });

  it("defaults to MongoJobRunner when no runner is injected", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("mongo-default", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    await getJobsService().enqueue({
      name: "mongo-default",
      payload: {},
    });

    await jobsApp.startWorker();
    await jobsApp.stopWorker();

    assert.isFalse(jobsApp.isWorkerActive());
  });

  it("compensates failed dispatch so idempotent retry creates and dispatches one row", async (): Promise<void> => {
    const runner = new FailingThenSucceedingRunner();
    const jobsApp = new JobsApp({runner});
    jobsApp.define("retry-dispatch", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    let firstError: unknown;
    try {
      await getJobsService().enqueue({
        idempotencyKey: "retry:1",
        name: "retry-dispatch",
        payload: {attempt: 1},
      });
    } catch (error: unknown) {
      firstError = error;
    }

    assert.instanceOf(firstError, JobDispatchError);
    assert.isTrue((firstError as JobDispatchError).compensationSucceeded);
    assert.equal(await Job.countDocuments({name: "retry-dispatch"}), 0);
    assert.equal(runner.dispatchAttempts, 1);
    assert.equal(runner.enqueuedJobs.length, 0);

    const retried = await getJobsService().enqueue({
      idempotencyKey: "retry:1",
      name: "retry-dispatch",
      payload: {attempt: 2},
    });

    assert.equal(runner.dispatchAttempts, 2);
    assert.equal(runner.enqueuedJobs.length, 1);
    assert.equal(runner.enqueuedJobs[0]._id.toString(), retried._id.toString());
    assert.equal(await Job.countDocuments({name: "retry-dispatch"}), 1);
  });

  it("reports compensation lost when dispatch fails after the row is claimed", async (): Promise<void> => {
    const runner: JobRunner = {
      enqueue: async (job: JobDocument): Promise<void> => {
        await Job.updateOne(
          {_id: job._id},
          {$set: {lockedAt: new Date(), lockedBy: "other-worker"}}
        );
        throw new Error("cloud dispatch failed after claim");
      },
      id: "claim-then-fail",
    };
    const jobsApp = new JobsApp({runner});
    jobsApp.define("claimed-dispatch", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    let caught: unknown;
    try {
      await getJobsService().enqueue({
        name: "claimed-dispatch",
        payload: {n: 1},
      });
    } catch (error: unknown) {
      caught = error;
    }

    assert.instanceOf(caught, JobDispatchError);
    assert.isFalse((caught as JobDispatchError).compensationSucceeded);
    assert.equal(await Job.countDocuments({name: "claimed-dispatch"}), 1);
  });

  it("compensates failed dispatch for non-keyed enqueue and leaves no orphan row", async (): Promise<void> => {
    const runner = new FailingThenSucceedingRunner();
    const jobsApp = new JobsApp({runner});
    jobsApp.define("orphan-free", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    let caught: unknown;
    try {
      await getJobsService().enqueue({
        name: "orphan-free",
        payload: {n: 1},
      });
    } catch (error: unknown) {
      caught = error;
    }

    assert.instanceOf(caught, JobDispatchError);
    assert.equal(await Job.countDocuments({name: "orphan-free"}), 0);
    assert.equal(runner.dispatchAttempts, 1);
  });

  it("dispatches exactly once when concurrent enqueues share an idempotencyKey", async (): Promise<void> => {
    const runner = new CountingDispatchRunner();
    const jobsApp = new JobsApp({runner});
    jobsApp.define("concurrent-dispatch", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    const results = await Promise.all(
      Array.from({length: 12}, () =>
        getJobsService().enqueue({
          idempotencyKey: "shared:42",
          name: "concurrent-dispatch",
          payload: {invoiceId: "42"},
        })
      )
    );

    const uniqueIds = new Set(results.map((job) => job._id.toString()));
    assert.equal(uniqueIds.size, 1);
    assert.equal(runner.dispatchCount, 1);
    assert.equal(await Job.countDocuments({name: "concurrent-dispatch"}), 1);
  });

  it("invokes runner.start only once for concurrent startWorker calls", async (): Promise<void> => {
    const fake = new FakeJobRunner();
    const jobsApp = new JobsApp({runner: fake});
    jobsApp.define("concurrent-start", {
      handler: async () => {},
    });
    registerJobsApp(jobsApp);

    await Promise.all([jobsApp.startWorker(), jobsApp.startWorker(), jobsApp.startWorker()]);

    assert.equal(fake.startCalls.length, 1);
    assert.isTrue(jobsApp.isWorkerActive());
    await jobsApp.stopWorker();
  });

  it("retries schedule tick after failed custom dispatch and creates exactly one child", async (): Promise<void> => {
    const runner = new FailingThenSucceedingRunner();
    const jobsApp = new JobsApp({pollIntervalMs: 25, runner});
    jobsApp.define("sched-dispatch-retry", {
      handler: async () => {},
      schedule: {cron: "0 9 * * *", timezone: "UTC"},
    });
    registerJobsApp(jobsApp);

    await getJobsService().reconcileSchedules();
    const schedule = await JobSchedule.findExactlyOne({name: "sched-dispatch-retry"});
    const dueRunAt = DateTime.utc().minus({minutes: 1}).toJSDate();
    await JobSchedule.updateOne({_id: schedule._id}, {$set: {nextRunAt: dueRunAt}});

    await tickDueSchedules({jobsService: getJobsService()});

    const rolledBack = await JobSchedule.findExactlyOne({_id: schedule._id});
    assert.equal(rolledBack.nextRunAt.toISOString(), dueRunAt.toISOString());
    assert.equal(await Job.countDocuments({name: "sched-dispatch-retry"}), 0);

    await tickDueSchedules({jobsService: getJobsService()});

    const childJobs = await Job.find({name: "sched-dispatch-retry"});
    assert.equal(childJobs.length, 1);
    assert.equal(
      childJobs[0]?.idempotencyKey,
      buildScheduleRunIdempotencyKey(schedule._id.toString(), dueRunAt)
    );
    assert.equal(runner.dispatchAttempts, 2);
    assert.equal(runner.enqueuedJobs.length, 1);
  });
});
