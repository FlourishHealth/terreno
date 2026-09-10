import {beforeEach, describe, it} from "bun:test";
import {
  type APIError,
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  createAccess,
  isAPIError,
  setupAuth,
  TerrenoApp,
  terrenoStatements,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import type {Application} from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import supertest from "supertest";

import {JobsApp} from "../jobsApp";
import {getJobsService} from "../jobsService";
import {Job} from "../models/job";
import {JobSchedule} from "../models/jobSchedule";

const typedUserModel = UserModel as unknown as UserModelType;
const ADMIN_EMAIL = "admin@example.com";

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

const buildTerrenoJobsApp = (jobsApp: JobsApp): Application =>
  new TerrenoApp({
    logRequests: false,
    skipListen: true,
    userModel: typedUserModel,
  })
    .register(jobsApp)
    .build();

const buildLegacyAuthApp = (jobsApp: JobsApp): Application => {
  const app = getBaseServer();
  setupAuth(app, typedUserModel);
  addAuthRoutes(app, typedUserModel);
  jobsApp.register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

const buildRbacApp = (
  grantsByEmail: Record<string, Record<string, string[]>>
): {app: Application; jobsApp: JobsApp} => {
  const accessControl = createAccess({
    connection: mongoose.connection,
    resolvePermissions: async ({user}) => {
      const email = "email" in user && typeof user.email === "string" ? user.email : "";
      return grantsByEmail[email] ?? {};
    },
    statements: terrenoStatements,
  });
  const jobsApp = new JobsApp({accessControl});
  return {app: buildLegacyAuthApp(jobsApp), jobsApp};
};

const seedJob = async (overrides: Record<string, unknown> = {}): Promise<mongoose.Document> =>
  Job.create({
    attemptCount: 0,
    backoffMs: 1_000,
    maxAttempts: 5,
    maxBackoffMs: 15 * 60 * 1_000,
    name: "demo-job",
    payload: {value: 1},
    payloadRedacted: false,
    runAt: DateTime.utc().toJSDate(),
    status: "pending",
    ...overrides,
  });

describe("jobs admin routes", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
    await JobSchedule.deleteMany({});
  });

  it("returns 401 for unauthenticated list requests", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("demo-job", {handler: async () => {}});
    const app = buildTerrenoJobsApp(jobsApp);

    await supertest(app).get("/jobs").expect(401);
    await supertest(app).get("/jobs/schedules").expect(401);
    await supertest(app).get("/jobs/stats").expect(401);
  });

  it("returns 403 for authenticated non-admins on legacy admin", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("demo-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const user = await authAsUser(app, "notAdmin");

    await user.get("/jobs").expect(403);
    await user.get("/jobs/schedules").expect(403);
    await user.get("/jobs/stats").expect(403);
    await user.post(`/jobs/${new mongoose.Types.ObjectId().toString()}/retry`).expect(403);
  });

  it("returns status counts from a single stats aggregation", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("stats-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    await seedJob({status: "dead"});
    await seedJob({status: "dead"});
    await seedJob({status: "running"});
    await seedJob({status: "pending"});
    await seedJob({status: "completed"});

    const stats = await admin.get("/jobs/stats").expect(200);
    assert.equal(stats.body.data.total, 5);
    assert.equal(stats.body.data.byStatus.dead, 2);
    assert.equal(stats.body.data.byStatus.running, 1);
    assert.equal(stats.body.data.byStatus.pending, 1);
    assert.equal(stats.body.data.byStatus.completed, 1);
    assert.equal(stats.body.data.byStatus.failed, 0);
    assert.equal(stats.body.data.byStatus.cancelled, 0);
    assert.equal(stats.body.data.byStatus.scheduled, 0);
  });

  it("allows legacy admins to list, filter, and paginate jobs", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("alpha", {handler: async () => {}});
    jobsApp.define("beta", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    await seedJob({lastError: "boom", name: "alpha", status: "dead"});
    await seedJob({name: "beta", status: "running"});
    await seedJob({name: "gamma", status: "pending"});

    const filtered = await admin.get("/jobs").query({name: "alpha", status: "dead"}).expect(200);
    assert.equal(filtered.body.total, 1);
    assert.equal(filtered.body.data[0].name, "alpha");

    const searched = await admin.get("/jobs").query({q: "boom"}).expect(200);
    assert.equal(searched.body.total, 1);

    const paged = await admin.get("/jobs").query({limit: 1, page: 2}).expect(200);
    assert.equal(paged.body.limit, 1);
    assert.equal(paged.body.page, 2);
    assert.isTrue(paged.body.more);
  });

  it("returns job detail and 404 for invalid ids", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("detail-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const job = await seedJob({
      attempts: [{at: DateTime.utc().toJSDate(), error: "failed once", errorClass: "Error"}],
      name: "detail-job",
      status: "dead",
    });

    const response = await admin.get(`/jobs/${String(job._id)}`).expect(200);
    assert.equal(response.body.data.name, "detail-job");
    assert.lengthOf(response.body.data.attempts, 1);

    await admin.get("/jobs/not-an-id").expect(404);
    await admin.get("/jobs/507f1f77bcf86cd799439011").expect(404);
  });

  it("does not expose POST /jobs for arbitrary browser create", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("demo-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    await admin.post("/jobs").send({name: "demo-job", payload: {}}).expect(404);
  });

  it("retry creates a linked row and sets retriedById on the original", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("retry-me", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const original = await seedJob({name: "retry-me", status: "dead"});

    const response = await admin.post(`/jobs/${String(original._id)}/retry`).expect(200);
    assert.notEqual(response.body.data._id, String(original._id));
    assert.equal(response.body.data.retriedFromId, String(original._id));

    const refreshed = await Job.findExactlyOne({_id: original._id});
    assert.equal(String(refreshed.retriedById), response.body.data._id);
  });

  it("requeue resets dead rows to pending now and clears locks", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("requeue-me", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const dead = await seedJob({
      lockedAt: DateTime.utc().toJSDate(),
      lockedBy: "worker:1",
      name: "requeue-me",
      status: "dead",
    });

    const response = await admin.post(`/jobs/${String(dead._id)}/requeue`).expect(200);
    assert.equal(response.body.data.status, "pending");
    assert.isUndefined(response.body.data.lockedAt);
    assert.isUndefined(response.body.data.lockedBy);
    assert.equal(String(response.body.data._id), String(dead._id));
  });

  it("returns 400 when cancelling completed or dead jobs", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("cancel-gate", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    for (const status of ["completed", "dead"] as const) {
      const job = await seedJob({name: "cancel-gate", status});
      await admin.post(`/jobs/${String(job._id)}/cancel`).expect(400);
    }
  });

  it("cancel moves pending jobs to cancelled", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("cancel-me", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const pending = await seedJob({name: "cancel-me", status: "pending"});

    const response = await admin.post(`/jobs/${String(pending._id)}/cancel`).expect(200);
    assert.equal(response.body.data.status, "cancelled");
  });

  it("cancel aborts a running local handler when feasible", async (): Promise<void> => {
    let sawAbort = false;
    let executionStarted = false;
    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("cancel-running", {
      handler: async (_payload, ctx) => {
        executionStarted = true;
        await waitUntil(() => Promise.resolve(ctx.signal.aborted));
        sawAbort = ctx.signal.aborted;
      },
    });

    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const enqueued = await getJobsService().enqueue({
      name: "cancel-running",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(() => Promise.resolve(executionStarted));

    const response = await admin.post(`/jobs/${String(enqueued._id)}/cancel`).expect(200);
    assert.equal(response.body.data.status, "cancelled");

    await waitUntil(() => Promise.resolve(sawAbort));
    await jobsApp.stopWorker();

    const refreshed = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(refreshed.status, "cancelled");
  });

  it("lists schedules and supports pause/resume without losing cron metadata", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("nightly", {
      handler: async () => {},
      schedule: {cron: "0 0 * * *", timezone: "UTC"},
    });
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    await getJobsService().reconcileSchedules();

    const listed = await admin.get("/jobs/schedules").expect(200);
    assert.lengthOf(listed.body.data, 1);
    assert.equal(listed.body.data[0].name, "nightly");
    assert.isTrue(listed.body.data[0].enabled);

    const paused = await admin.post("/jobs/schedules/nightly/pause").expect(200);
    assert.isFalse(paused.body.data.enabled);
    assert.equal(paused.body.data.cron, "0 0 * * *");

    const resumed = await admin.post("/jobs/schedules/nightly/resume").expect(200);
    assert.isTrue(resumed.body.data.enabled);
  });

  it("routes /jobs/stats before /jobs/:id", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("stats-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    await seedJob({status: "dead"});
    await seedJob({status: "running"});

    const stats = await admin.get("/jobs/stats").expect(200);
    assert.equal(stats.body.data.total, 2);
    assert.equal(stats.body.data.byStatus.dead, 1);
    assert.equal(stats.body.data.byStatus.running, 1);

    await admin.get("/jobs/stats").query({page: 1}).expect(200);
    await admin.get("/jobs/not-an-id").expect(404);
  });

  it("routes /jobs/schedules before /jobs/:id", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("schedules", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    const response = await admin.get("/jobs/schedules").expect(200);
    assert.isArray(response.body.data);
  });

  it("documents admin routes in OpenAPI", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("openapi-job", {handler: async () => {}});
    const app = buildTerrenoJobsApp(jobsApp);

    const response = await supertest(app).get("/openapi.json").expect(200);

    assert.property(response.body.paths, "/jobs");
    assert.property(response.body.paths["/jobs"], "get");
    assert.notProperty(response.body.paths["/jobs"], "post");
    assert.property(response.body.paths, "/jobs/{id}");
    assert.property(response.body.paths, "/jobs/{id}/retry");
    assert.property(response.body.paths, "/jobs/{id}/requeue");
    assert.property(response.body.paths, "/jobs/{id}/cancel");
    assert.property(response.body.paths, "/jobs/stats");
    assert.property(response.body.paths, "/jobs/schedules");
    assert.property(response.body.paths, "/jobs/schedules/{name}/pause");
    assert.property(response.body.paths, "/jobs/schedules/{name}/resume");
  });

  it("documents list and schedule array item schemas in OpenAPI", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("openapi-job", {handler: async () => {}});
    const app = buildTerrenoJobsApp(jobsApp);

    const response = await supertest(app).get("/openapi.json").expect(200);

    const listSchema =
      response.body.paths["/jobs"].get.responses["200"].content["application/json"].schema;
    assert.equal(listSchema.properties.data.type, "array");
    assert.equal(listSchema.properties.data.items.type, "object");
    assert.equal(listSchema.properties.data.items.properties.name.type, "string");
    assert.equal(listSchema.properties.data.items.properties.status.type, "string");
    assert.equal(listSchema.properties.limit.type, "number");
    assert.equal(listSchema.properties.more.type, "boolean");

    const schedulesSchema =
      response.body.paths["/jobs/schedules"].get.responses["200"].content["application/json"]
        .schema;
    assert.equal(schedulesSchema.properties.data.type, "array");
    assert.equal(schedulesSchema.properties.data.items.type, "object");
    assert.equal(schedulesSchema.properties.data.items.properties.name.type, "string");
    assert.equal(schedulesSchema.properties.data.items.properties.cron.type, "string");
    assert.equal(schedulesSchema.properties.data.items.properties.enabled.type, "boolean");

    const statsSchema =
      response.body.paths["/jobs/stats"].get.responses["200"].content["application/json"].schema;
    assert.equal(statsSchema.properties.data.type, "object");
    assert.equal(statsSchema.properties.data.properties.byStatus.type, "object");
    assert.equal(statsSchema.properties.data.properties.total.type, "number");
  });

  it("omits payload from list and detail by default", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("secret-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const job = await seedJob({
      name: "secret-job",
      payload: {secret: "do-not-leak"},
      status: "dead",
    });

    const listed = await admin.get("/jobs").expect(200);
    assert.notProperty(listed.body.data[0], "payload");

    const detail = await admin.get(`/jobs/${String(job._id)}`).expect(200);
    assert.notProperty(detail.body.data, "payload");
  });

  it("uses redactPayload hook for trusted admin projections", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      redactPayload: ({payload}) => payload,
    });
    jobsApp.define("trusted-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const job = await seedJob({
      name: "trusted-job",
      payload: {visible: true},
      status: "failed",
    });

    const detail = await admin.get(`/jobs/${String(job._id)}`).expect(200);
    assert.deepEqual(detail.body.data.payload, {visible: true});
  });

  it("always omits payload when payloadRedacted is true", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      redactPayload: ({payload}) => payload,
    });
    jobsApp.define("redacted-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const job = await seedJob({
      name: "redacted-job",
      payload: {secret: true},
      payloadRedacted: true,
      status: "dead",
    });

    const detail = await admin.get(`/jobs/${String(job._id)}`).expect(200);
    assert.notProperty(detail.body.data, "payload");
  });

  it("supports custom redactPayload projections", async (): Promise<void> => {
    const jobsApp = new JobsApp({
      redactPayload: () => ({kind: "redacted"}),
    });
    jobsApp.define("projected-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const job = await seedJob({
      name: "projected-job",
      payload: {secret: true},
      status: "failed",
    });

    const detail = await admin.get(`/jobs/${String(job._id)}`).expect(200);
    assert.deepEqual(detail.body.data.payload, {kind: "redacted"});
  });

  it("retry stores raw payload internally while admin responses omit it", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("retry-secret", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const original = await seedJob({
      name: "retry-secret",
      payload: {token: "raw-value"},
      status: "dead",
    });

    const response = await admin.post(`/jobs/${String(original._id)}/retry`).expect(200);
    assert.notProperty(response.body.data, "payload");

    const retryRow = await Job.findExactlyOne({_id: response.body.data._id});
    assert.deepEqual(retryRow.payload, {token: "raw-value"});
  });

  it("treats q as a literal regex and rejects oversized queries", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("regex-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    await seedJob({lastError: "matched literal .* token", name: "regex-job", status: "dead"});
    await seedJob({lastError: "unrelated failure", name: "other-job", status: "dead"});

    const literal = await admin.get("/jobs").query({q: ".*"}).expect(200);
    assert.equal(literal.body.total, 1);
    assert.equal(literal.body.data[0].name, "regex-job");

    const oversized = "x".repeat(201);
    await admin.get("/jobs").query({q: oversized}).expect(400);
  });

  it("returns 400 for invalid list filters", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("filter-job", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    await admin.get("/jobs").query({scheduleId: "not-an-object-id"}).expect(400);
    await admin.get("/jobs").query({start: "not-a-date"}).expect(400);
    await admin.get("/jobs").query({status: "bogus"}).expect(400);
  });

  it("returns 400 when retrying non-terminal jobs", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("retry-gate", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    for (const status of ["completed", "pending", "running", "cancelled"] as const) {
      const job = await seedJob({name: "retry-gate", status});
      await admin.post(`/jobs/${String(job._id)}/retry`).expect(400);
    }
  });

  it("returns 409 when retrying the same job twice", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("double-retry", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const original = await seedJob({name: "double-retry", status: "failed"});

    await admin.post(`/jobs/${String(original._id)}/retry`).expect(200);
    await admin.post(`/jobs/${String(original._id)}/retry`).expect(409);
  });

  it("requeues failed and cancelled jobs to pending", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("requeue-status", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");

    const failed = await seedJob({name: "requeue-status", status: "failed"});
    const failedResponse = await admin.post(`/jobs/${String(failed._id)}/requeue`).expect(200);
    assert.equal(failedResponse.body.data.status, "pending");

    const cancelled = await seedJob({name: "requeue-status", status: "cancelled"});
    const cancelledResponse = await admin
      .post(`/jobs/${String(cancelled._id)}/requeue`)
      .expect(200);
    assert.equal(cancelledResponse.body.data.status, "pending");
  });

  it("returns 409 when requeueing an original that already has retriedById", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("linked-requeue", {handler: async () => {}});
    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const original = await seedJob({name: "linked-requeue", status: "dead"});

    const retried = await admin.post(`/jobs/${String(original._id)}/retry`).expect(200);
    await admin.post(`/jobs/${String(original._id)}/requeue`).expect(409);

    const refreshed = await Job.findExactlyOne({_id: original._id});
    assert.equal(String(refreshed.retriedById), retried.body.data._id);
    assert.equal(refreshed.status, "dead");

    const retryRow = await Job.findExactlyOne({_id: retried.body.data._id});
    assert.equal(retryRow.status, "pending");
  });

  it("allows only one of concurrent retry and requeue on the same row", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("race-job", {handler: async () => {}});
    buildLegacyAuthApp(jobsApp);
    const original = await seedJob({name: "race-job", status: "failed"});
    const jobId = String(original._id);
    const service = getJobsService();

    const outcomes = await Promise.allSettled([
      service.adminRetryJob(jobId),
      service.adminRequeueJob(jobId),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    assert.lengthOf(fulfilled, 1);
    assert.lengthOf(rejected, 1);

    const failure = rejected[0] as PromiseRejectedResult;
    assert.isTrue(isAPIError(failure.reason));
    const loserStatus = (failure.reason as APIError).status;
    assert.oneOf(loserStatus, [400, 409]);

    const refreshed = await Job.findExactlyOne({_id: original._id});
    const linkedRetries = await Job.find({retriedFromId: original._id});
    const orphanRetries = await Job.find({
      _id: {$nin: [original._id]},
      name: "race-job",
      retriedFromId: {$exists: false},
      status: "pending",
    });

    if (refreshed.retriedById) {
      assert.equal(loserStatus, 409);
      assert.oneOf(refreshed.status, ["dead", "failed"]);
      assert.lengthOf(linkedRetries, 1);
      assert.equal(String(linkedRetries[0]?._id), String(refreshed.retriedById));
      assert.equal(linkedRetries[0]?.status, "pending");
      assert.lengthOf(orphanRetries, 0);
      return;
    }

    assert.equal(refreshed.status, "pending");
    assert.isUndefined(refreshed.retriedById);
    assert.lengthOf(linkedRetries, 0);
    assert.lengthOf(orphanRetries, 0);
    assert.oneOf(loserStatus, [400, 409]);
  });

  it("returns 401 for unauthenticated mutations", async (): Promise<void> => {
    const jobsApp = new JobsApp();
    jobsApp.define("mutation-job", {
      handler: async () => {},
      schedule: {cron: "0 0 * * *", timezone: "UTC"},
    });
    const app = buildLegacyAuthApp(jobsApp);
    await getJobsService().reconcileSchedules();

    const jobId = String((await seedJob({name: "mutation-job", status: "dead"}))._id);

    await supertest(app).post(`/jobs/${jobId}/retry`).expect(401);
    await supertest(app).post(`/jobs/${jobId}/requeue`).expect(401);
    await supertest(app).post(`/jobs/${jobId}/cancel`).expect(401);
    await supertest(app).post("/jobs/schedules/mutation-job/pause").expect(401);
  });

  it("keeps cancelled status when a cloud handler returns success after admin cancel", async (): Promise<void> => {
    let resolveHandler: () => void = () => {};
    const handlerDone = new Promise<void>((resolve) => {
      resolveHandler = resolve;
    });
    let executionStarted = false;

    const jobsApp = new JobsApp({pollIntervalMs: 25});
    jobsApp.define("cloud-cancel", {
      handler: async () => {
        executionStarted = true;
        await handlerDone;
      },
    });

    const app = buildLegacyAuthApp(jobsApp);
    const admin = await authAsUser(app, "admin");
    const enqueued = await getJobsService().enqueue({
      name: "cloud-cancel",
      payload: {},
    });

    await jobsApp.startWorker();
    await waitUntil(() => Promise.resolve(executionStarted));

    await admin.post(`/jobs/${String(enqueued._id)}/cancel`).expect(200);
    resolveHandler();

    await waitUntil(async () => {
      const job = await Job.findOneOrNone({_id: enqueued._id});
      return job?.status !== "running";
    });
    await jobsApp.stopWorker();

    const refreshed = await Job.findExactlyOne({_id: enqueued._id});
    assert.equal(refreshed.status, "cancelled");
  });
});

describe("jobs admin RBAC", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
  });

  it("requires admin:access and admin:jobs when accessControl is configured", async (): Promise<void> => {
    const {app} = buildRbacApp({
      [ADMIN_EMAIL]: {admin: ["access", "jobs"]},
    });
    const allowed = await authAsUser(app, "admin");
    await allowed.get("/jobs").expect(200);
  });

  it("returns 403 when the caller lacks admin:jobs", async (): Promise<void> => {
    const {app} = buildRbacApp({
      [ADMIN_EMAIL]: {admin: ["access"]},
    });
    const agent = await authAsUser(app, "admin");
    await agent.get("/jobs").expect(403);
  });

  it("returns 403 when the caller lacks admin:access even with admin:jobs", async (): Promise<void> => {
    const {app} = buildRbacApp({
      [ADMIN_EMAIL]: {admin: ["jobs"]},
    });
    const agent = await authAsUser(app, "admin");
    await agent.get("/jobs").expect(403);
  });

  it("returns 403 for mutations when the caller lacks admin:jobs", async (): Promise<void> => {
    const {app, jobsApp} = buildRbacApp({
      [ADMIN_EMAIL]: {admin: ["access"]},
    });
    jobsApp.define("rbac-job", {
      handler: async () => {},
      schedule: {cron: "0 0 * * *", timezone: "UTC"},
    });
    await getJobsService().reconcileSchedules();

    const agent = await authAsUser(app, "admin");
    const dead = await seedJob({name: "rbac-job", status: "dead"});

    await agent.post(`/jobs/${String(dead._id)}/retry`).expect(403);
    await agent.post("/jobs/schedules/rbac-job/pause").expect(403);
  });
});

describe("JobsApp.adminContribution", () => {
  it("registers the jobs admin screen and home widget metadata", (): void => {
    const contribution = new JobsApp().adminContribution?.();
    assert.exists(contribution);
    assert.deepEqual(contribution?.customScreens, [
      {displayName: "Jobs", icon: "clock", name: "jobs"},
    ]);
    assert.deepEqual(contribution?.homeWidgets, [{displayName: "Jobs", icon: "clock", id: "jobs"}]);
  });
});
