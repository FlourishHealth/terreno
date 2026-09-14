import {beforeEach, describe, it} from "bun:test";
import {AdminApp, aggregateFromTerrenoApp} from "@terreno/admin-backend";
import {TerrenoApp, type UserModel as TerrenoAuthUserModel} from "@terreno/api";
import {Job, JobSchedule} from "@terreno/jobs";
import {assert} from "chai";
import supertest from "supertest";
import {access} from "../access";
import {exampleAdminHome} from "../exampleAdminConfig";
import {User} from "../models/user";
import {createExampleJobsApp} from "./createExampleJobsApp";

const typedUserModel = User as unknown as TerrenoAuthUserModel;

describe("example JobsApp integration", () => {
  beforeEach(async (): Promise<void> => {
    await Job.deleteMany({});
    await JobSchedule.deleteMany({});
  });

  it("registers JobsApp before AdminApp so jobs appears in aggregated admin config", (): void => {
    const jobsApp = createExampleJobsApp({accessControl: access});
    const terraApp = new TerrenoApp({
      accessControl: access,
      skipListen: true,
      userModel: typedUserModel,
    });
    terraApp.register(jobsApp);
    terraApp.register(new AdminApp({accessControl: access, home: exampleAdminHome, models: []}));

    const aggregated = aggregateFromTerrenoApp({terrenoApp: terraApp});
    const jobsScreen = aggregated.customScreens.find((screen) => screen.name === "jobs");
    assert.isDefined(jobsScreen);
    assert.equal(jobsScreen?.displayName, "Jobs");
    assert.include(aggregated.widgetIds, "jobs");
    assert.include(exampleAdminHome.slots?.sidebar ?? [], "jobs");
  });

  it("exposes jobs admin routes on OpenAPI without starting a worker", async (): Promise<void> => {
    const jobsApp = createExampleJobsApp({accessControl: access});
    assert.isFalse(jobsApp.isWorkerActive());

    const app = new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(jobsApp)
      .build();

    const res = await supertest(app).get("/openapi.json").expect(200);

    assert.property(res.body.paths, "/jobs");
    assert.property(res.body.paths, "/jobs/{id}");
    assert.property(res.body.paths, "/jobs/stats");
    assert.property(res.body.paths, "/jobs/schedules");
    assert.property(res.body.paths["/jobs/{id}"], "get");
    assert.property(res.body.paths["/jobs/{id}/retry"], "post");
    assert.property(res.body.paths["/jobs/{id}/requeue"], "post");
    assert.property(res.body.paths["/jobs/{id}/cancel"], "post");
  });

  it("defines the example demo job names on the shared JobsApp instance", (): void => {
    const jobsApp = createExampleJobsApp();
    assert.isDefined(jobsApp.getDefinition("example/log-message"));
    assert.isDefined(jobsApp.getDefinition("example/heartbeat"));
    assert.isDefined(jobsApp.getDefinition("example/dlq-demo"));
    assert.isDefined(jobsApp.getDefinition("example/heartbeat")?.schedule);
  });

  it("runs demo handlers for log, heartbeat, and intentional DLQ failure", async (): Promise<void> => {
    const jobsApp = createExampleJobsApp();
    const logs: string[] = [];
    const ctx = {
      jobId: "job-demo",
      log: {
        info: (message: string) => {
          logs.push(message);
        },
        warn: (message: string) => {
          logs.push(message);
        },
      },
      signal: new AbortController().signal,
    };

    await jobsApp.getDefinition("example/log-message")?.handler({message: "hi-demo"}, ctx as never);
    await jobsApp.getDefinition("example/log-message")?.handler({}, ctx as never);
    await jobsApp.getDefinition("example/heartbeat")?.handler({}, ctx as never);

    let dlqError: unknown;
    try {
      await jobsApp.getDefinition("example/dlq-demo")?.handler({}, ctx as never);
    } catch (error: unknown) {
      dlqError = error;
    }

    assert.include(logs, "hi-demo");
    assert.include(logs, "hello from example job");
    assert.include(logs, "example heartbeat tick");
    assert.include(logs, "intentional failure for dead-letter queue demonstration");
    assert.instanceOf(dlqError, Error);
    assert.equal((dlqError as {status?: number}).status, 500);
  });
});
