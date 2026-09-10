import {beforeEach, describe, it} from "bun:test";
import {TerrenoApp, type UserModel as UserModelType} from "@terreno/api";
import {setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import type {Application, Request} from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import supertest from "supertest";

import {JobsApp} from "../jobsApp";
import {getJobsService} from "../jobsService";
import {Job} from "../models/job";
import {JobSchedule} from "../models/jobSchedule";
import type {JobDocument} from "../modelTypes";
import type {ExecuteAuthVerifier} from "../routes/jobsExecute";
import {getWorkerId} from "../runners/mongoRunner";
import type {JobRunner, JobRunnerStartOptions} from "../types";

const typedUserModel = UserModel as unknown as UserModelType;

const validExecuteAuth = (req: Request): boolean =>
  req.headers.authorization === "Bearer execute-token";

class ExecuteRouteRunner implements JobRunner {
  readonly id = "execute-route-runner";
  readonly requiresExecuteRoute = true;

  async enqueue(_job: JobDocument): Promise<void> {}

  async start(options: JobRunnerStartOptions): Promise<void> {
    await new Promise<void>((resolve) => {
      if (options.signal.aborted) {
        resolve();
        return;
      }

      options.signal.addEventListener("abort", () => resolve(), {once: true});
    });
  }

  async stop(): Promise<void> {}
}

const buildApp = (
  jobsApp: JobsApp,
  options?: {logRequests?: boolean; rateLimit?: {limits: {apiMax: number; authMax: number}}}
): Application =>
  new TerrenoApp({
    logRequests: options?.logRequests ?? false,
    rateLimit: options?.rateLimit,
    skipListen: true,
    userModel: typedUserModel,
  })
    .register(jobsApp)
    .build();

const executePath = (basePath: string): string => `${basePath}/execute`;

const authHeaders = {Authorization: "Bearer execute-token"};

const waitUntil = async (
  predicate: () => Promise<boolean>,
  options?: {intervalMs?: number; timeoutMs?: number}
): Promise<void> => {
  const intervalMs = options?.intervalMs ?? 10;
  const timeoutMs = options?.timeoutMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await Bun.sleep(intervalMs);
  }

  throw new Error("waitUntil timed out");
};

describe("POST /jobs/execute", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
    await JobSchedule.deleteMany({});
  });

  it("does not mount the execute route by default for MongoJobRunner", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("default-mongo", {
      handler: async () => {},
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set("Authorization", "Bearer execute-token")
      .send({jobId: new mongoose.Types.ObjectId().toString()});

    assert.equal(response.status, 404);
  });

  it("mounts the execute route when mountExecuteRoute is true", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("mounted", {
      handler: async () => {},
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set("Authorization", "Bearer execute-token")
      .send({jobId: new mongoose.Types.ObjectId().toString()});

    assert.equal(response.status, 404);
    assert.notEqual(response.status, 401);
  });

  it("mounts the execute route when the runner requires it", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      runner: new ExecuteRouteRunner(),
    });
    jobsApp.define("runner-mounted", {
      handler: async () => {},
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set("Authorization", "Bearer execute-token")
      .send({jobId: new mongoose.Types.ObjectId().toString()});

    assert.equal(response.status, 404);
  });

  it("uses the configured basePath for the execute route", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      basePath: "/background",
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("custom-base", {
      handler: async () => {},
    });

    const app = buildApp(jobsApp);
    const wrongPath = await supertest(app)
      .post("/jobs/execute")
      .set("Authorization", "Bearer execute-token")
      .send({jobId: new mongoose.Types.ObjectId().toString()});
    const rightPath = await supertest(app)
      .post("/background/execute")
      .set("Authorization", "Bearer execute-token")
      .send({jobId: new mongoose.Types.ObjectId().toString()});

    assert.equal(wrongPath.status, 404);
    assert.equal(rightPath.status, 404);
  });

  it("throws during register when the execute route is enabled without executeAuth", (): void => {
    const jobsApp = new JobsApp({mountExecuteRoute: true});

    assert.throws(() => buildApp(jobsApp), /executeAuth/i);
  });

  it("returns 401 when execute auth is missing or invalid", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("auth-gate", {
      handler: async () => {},
    });

    const app = buildApp(jobsApp);
    const missing = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .send({jobId: new mongoose.Types.ObjectId().toString()});
    const invalid = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set("Authorization", "Bearer wrong")
      .send({jobId: new mongoose.Types.ObjectId().toString()});

    assert.equal(missing.status, 401);
    assert.equal(invalid.status, 401);
  });

  it("returns 400 when jobId is missing or not a non-empty string", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("body-validation", {
      handler: async () => {},
    });

    const app = buildApp(jobsApp);
    const missing = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set(authHeaders)
      .send({});
    const numeric = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set(authHeaders)
      .send({jobId: 123});
    const empty = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set(authHeaders)
      .send({jobId: "   "});

    assert.equal(missing.status, 400);
    assert.equal(numeric.status, 400);
    assert.equal(empty.status, 400);
    assert.equal(missing.body.title, "jobId is required");
  });

  it("returns 404 for unknown or invalid object-id jobId without leaking details", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("missing-job", {
      handler: async () => {},
    });

    const app = buildApp(jobsApp);
    const unknown = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set(authHeaders)
      .send({jobId: new mongoose.Types.ObjectId().toString()});
    const malformed = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set(authHeaders)
      .send({jobId: "not-an-object-id"});

    assert.equal(unknown.status, 404);
    assert.equal(malformed.status, 404);
    assert.equal(unknown.body.title, malformed.body.title);
  });

  it("returns 401 for terminal jobs when execute auth is missing", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("terminal-unauth", {
      handler: async () => {},
    });

    const job = await Job.create({
      attemptCount: 0,
      backoffMs: 1_000,
      maxAttempts: 3,
      maxBackoffMs: 60_000,
      name: "terminal-unauth",
      payload: {},
      payloadRedacted: false,
      runAt: DateTime.utc().toJSDate(),
      status: "completed",
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .send({jobId: job._id.toString()});

    assert.equal(response.status, 401);
  });

  it("returns 401 when executeAuth throws or rejects without running the handler", async (): Promise<void> => {
    const verifierCases: ExecuteAuthVerifier[] = [
      () => {
        throw new Error("sync throw");
      },
      async () => {
        throw new Error("async throw");
      },
      async () => false,
    ];

    for (const executeAuth of verifierCases) {
      let handlerCalls = 0;
      const jobsApp = new JobsApp({
        executeAuth,
        mountExecuteRoute: true,
      });
      jobsApp.define("auth-fail-closed", {
        handler: async () => {
          handlerCalls += 1;
        },
      });
      buildApp(jobsApp);

      const job = await getJobsService().enqueue({
        name: "auth-fail-closed",
        payload: {case: executeAuth},
      });

      const response = await supertest(buildApp(jobsApp))
        .post(executePath(jobsApp.getBasePath()))
        .set(authHeaders)
        .send({jobId: job._id.toString()});

      assert.equal(response.status, 401);
      assert.equal(handlerCalls, 0);

      const unchanged = await Job.findExactlyOne({_id: job._id});
      assert.equal(unchanged.status, "pending");
      await Job.deleteMany({name: "auth-fail-closed"});
    }
  });

  it("returns 200 no-op for completed, cancelled, dead, and failed terminal jobs", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("terminal", {
      handler: async () => {},
    });

    for (const status of ["completed", "cancelled", "dead", "failed"] as const) {
      const job = await Job.create({
        attemptCount: status === "dead" ? 3 : 0,
        backoffMs: 1_000,
        lastError: status === "failed" ? "missing handler" : undefined,
        maxAttempts: 3,
        maxBackoffMs: 60_000,
        name: "terminal",
        payload: {status},
        payloadRedacted: false,
        runAt: DateTime.utc().toJSDate(),
        status,
      });

      const app = buildApp(jobsApp);
      const response = await supertest(app)
        .post(executePath(jobsApp.getBasePath()))
        .set("Authorization", "Bearer execute-token")
        .send({jobId: job._id.toString()});

      assert.equal(response.status, 200);
      assert.equal(response.body.data.status, status);
      assert.equal(response.body.data.id, job._id.toString());
    }
  });

  it("returns 409 when the job is running under a live lock", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      lockTtlMs: 60_000,
      mountExecuteRoute: true,
    });
    jobsApp.define("live-lock", {
      handler: async () => {},
    });

    const job = await Job.create({
      attemptCount: 0,
      backoffMs: 1_000,
      lockedAt: DateTime.utc().toJSDate(),
      lockedBy: `${getWorkerId()}:live-lock-token`,
      maxAttempts: 3,
      maxBackoffMs: 60_000,
      name: "live-lock",
      payload: {},
      payloadRedacted: false,
      runAt: DateTime.utc().toJSDate(),
      status: "running",
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set("Authorization", "Bearer execute-token")
      .send({jobId: job._id.toString()});

    assert.equal(response.status, 409);
    const stillRunning = await Job.findExactlyOne({_id: job._id});
    assert.equal(stillRunning.status, "running");
  });

  it("returns 409 when runAt is still in the future", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("future-run", {
      handler: async () => {},
    });
    buildApp(jobsApp);

    const job = await getJobsService().enqueue({
      name: "future-run",
      payload: {n: 1},
      runAt: DateTime.utc().plus({hours: 1}).toJSDate(),
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set("Authorization", "Bearer execute-token")
      .send({jobId: job._id.toString()});

    assert.equal(response.status, 409);
    const unchanged = await Job.findExactlyOne({_id: job._id});
    assert.equal(unchanged.status, "pending");
  });

  it("claims and executes a due pending job without polling another row", async (): Promise<void> => {
    let executedJobId: string | undefined;
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("due-pending", {
      handler: async (_payload, ctx) => {
        executedJobId = ctx.jobId;
      },
    });
    buildApp(jobsApp);

    const target = await getJobsService().enqueue({
      name: "due-pending",
      payload: {target: true},
    });
    const other = await getJobsService().enqueue({
      name: "due-pending",
      payload: {other: true},
      runAt: DateTime.utc().minus({minutes: 5}).toJSDate(),
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set("Authorization", "Bearer execute-token")
      .send({jobId: target._id.toString()});

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "completed");
    assert.equal(response.body.data.id, target._id.toString());
    assert.equal(executedJobId, target._id.toString());

    const otherRow = await Job.findExactlyOne({_id: other._id});
    assert.equal(otherRow.status, "pending");
  });

  it("records handler failures with retry semantics on execute", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("retry-on-execute", {
      handler: async () => {
        throw new Error("execute boom");
      },
      retry: {maxAttempts: 3},
    });
    buildApp(jobsApp);

    const job = await getJobsService().enqueue({
      name: "retry-on-execute",
      payload: {},
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set("Authorization", "Bearer execute-token")
      .send({jobId: job._id.toString()});

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "pending");
    assert.equal(response.body.data.attemptCount, 1);
    assert.isAbove(new Date(response.body.data.runAt).getTime(), Date.now() - 5_000);
  });

  it("reclaims and executes a job with a stale running lock", async (): Promise<void> => {
    let handlerCalls = 0;
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      lockTtlMs: 100,
      mountExecuteRoute: true,
    });
    jobsApp.define("stale-lock", {
      handler: async () => {
        handlerCalls += 1;
      },
    });

    const job = await Job.create({
      attemptCount: 0,
      backoffMs: 1_000,
      lockedAt: DateTime.utc().minus({seconds: 1}).toJSDate(),
      lockedBy: `${getWorkerId()}:stale-token`,
      maxAttempts: 3,
      maxBackoffMs: 60_000,
      name: "stale-lock",
      payload: {},
      payloadRedacted: false,
      runAt: DateTime.utc().toJSDate(),
      status: "running",
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set(authHeaders)
      .send({jobId: job._id.toString()});

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "completed");
    assert.equal(handlerCalls, 1);
  });

  it("runs the handler once when two execute requests race and returns 200 then 409", async (): Promise<void> => {
    let handlerCalls = 0;

    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      lockTtlMs: 60_000,
      mountExecuteRoute: true,
    });
    jobsApp.define("concurrent-execute", {
      handler: async () => {
        handlerCalls += 1;
        await Bun.sleep(500);
      },
    });
    buildApp(jobsApp);

    const job = await getJobsService().enqueue({
      name: "concurrent-execute",
      payload: {},
    });

    const app = buildApp(jobsApp);
    const path = executePath(jobsApp.getBasePath());
    const firstPromise = supertest(app)
      .post(path)
      .set(authHeaders)
      .send({jobId: job._id.toString()})
      .then((response) => response);

    await waitUntil(async () => {
      const row = await Job.findExactlyOne({_id: job._id});
      return row.status === "running";
    });
    const second = await supertest(app)
      .post(path)
      .set(authHeaders)
      .send({jobId: job._id.toString()});
    const first = await firstPromise;

    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(handlerCalls, 1);

    const completed = await Job.findExactlyOne({_id: job._id});
    assert.equal(completed.status, "completed");
  });

  it("returns 200 with dead status when the final attempt exhausts maxAttempts", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("final-dead", {
      handler: async () => {
        throw new Error("terminal failure");
      },
      retry: {maxAttempts: 1},
    });
    buildApp(jobsApp);

    const job = await getJobsService().enqueue({
      name: "final-dead",
      payload: {},
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app)
      .post(executePath(jobsApp.getBasePath()))
      .set(authHeaders)
      .send({jobId: job._id.toString()});

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "dead");
    assert.equal(response.body.data.attemptCount, 1);
  });

  it("is subject to TerrenoApp API rate limits and is not on the skip list", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("rate-limited", {
      handler: async () => {},
    });
    buildApp(jobsApp);

    const job = await getJobsService().enqueue({
      name: "rate-limited",
      payload: {},
    });

    const app = buildApp(jobsApp, {rateLimit: {limits: {apiMax: 1, authMax: 20}}});
    const path = executePath(jobsApp.getBasePath());

    const first = await supertest(app)
      .post(path)
      .set(authHeaders)
      .send({jobId: job._id.toString()});
    const second = await supertest(app)
      .post(path)
      .set(authHeaders)
      .send({jobId: new mongoose.Types.ObjectId().toString()});

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(second.body.code, "rate-limit-exceeded");
  });

  it("does not appear in the public OpenAPI document", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      executeAuth: validExecuteAuth,
      mountExecuteRoute: true,
    });
    jobsApp.define("openapi-hidden", {
      handler: async () => {},
    });

    const app = buildApp(jobsApp);
    const response = await supertest(app).get("/openapi.json").expect(200);

    assert.notProperty(response.body.paths, "/jobs/execute");
  });
});
