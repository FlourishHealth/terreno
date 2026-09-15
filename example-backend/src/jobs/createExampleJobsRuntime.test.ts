import {describe, it} from "bun:test";
import type {
  GcpCloudTasksClient,
  GcpCreateTaskRequest,
  GcpCreateTaskResponse,
} from "@terreno/jobs/runners/gcpCloudTasks";
import {assert} from "chai";
import type {Request} from "express";
import {DateTime} from "luxon";

import {
  createExampleJobsRuntime,
  type IdTokenPayload,
  type IdTokenVerifier,
} from "./createExampleJobsRuntime";

const CLOUD_TASKS_ENVIRONMENT = {
  GCP_TASKS_LOCATION: "us-central1",
  GCP_TASKS_OIDC_AUDIENCE: "https://tasks.example.com",
  GCP_TASKS_PROJECT: "example-project",
  GCP_TASKS_PUBLIC_URL: "https://pr-123---tasks.example.com",
  GCP_TASKS_QUEUE: "example-jobs",
  GCP_TASKS_SERVICE_ACCOUNT_EMAIL: "tasks@example-project.iam.gserviceaccount.com",
  JOBS_RUNNER: "gcp-cloud-tasks",
};

const createRequest = (authorization?: string): Request =>
  ({
    header: (name: string): string | undefined =>
      name.toLowerCase() === "authorization" ? authorization : undefined,
  }) as Request;

const createVerifier = (payload: IdTokenPayload | undefined): IdTokenVerifier => ({
  verifyIdToken: async (): Promise<{getPayload: () => IdTokenPayload | undefined}> => ({
    getPayload: () => payload,
  }),
});

describe("createExampleJobsRuntime", () => {
  it("uses the Mongo runner by default", (): void => {
    const runtime = createExampleJobsRuntime({environment: {}});

    assert.equal(runtime.runner.id, "mongo");
    assert.isUndefined(runtime.executeAuth);
  });

  it("fails fast when Cloud Tasks configuration is incomplete", (): void => {
    assert.throws(
      () =>
        createExampleJobsRuntime({
          environment: {JOBS_RUNNER: "gcp-cloud-tasks"},
        }),
      /GCP_TASKS_PROJECT is required/
    );
    assert.throws(
      () => createExampleJobsRuntime({environment: {JOBS_RUNNER: "unknown"}}),
      /Unsupported JOBS_RUNNER/
    );
  });

  it("dispatches to the PR-specific URL through the shared queue", async (): Promise<void> => {
    let request: GcpCreateTaskRequest | undefined;
    const cloudTasksClient: GcpCloudTasksClient = {
      createTask: async (value): Promise<[GcpCreateTaskResponse]> => {
        request = value;
        return [{}];
      },
      queuePath: (project, location, queue): string =>
        `projects/${project}/locations/${location}/queues/${queue}`,
    };
    const runtime = createExampleJobsRuntime({
      cloudTasksClient,
      environment: CLOUD_TASKS_ENVIRONMENT,
      idTokenVerifier: createVerifier(undefined),
    });

    await runtime.runner.enqueue({
      _id: {toString: () => "job-123"},
      runAt: DateTime.utc().toJSDate(),
    } as never);

    assert.equal(
      request?.parent,
      "projects/example-project/locations/us-central1/queues/example-jobs"
    );
    assert.equal(request?.task.httpRequest?.url, "https://pr-123---tasks.example.com/jobs/execute");
    assert.equal(request?.task.httpRequest?.oidcToken?.audience, "https://tasks.example.com");
  });

  it("accepts only verified tokens from the configured task service account", async (): Promise<void> => {
    const validRuntime = createExampleJobsRuntime({
      cloudTasksClient: {
        createTask: async (): Promise<[GcpCreateTaskResponse]> => [{}],
        queuePath: (): string => "queue",
      },
      environment: CLOUD_TASKS_ENVIRONMENT,
      idTokenVerifier: createVerifier({
        email: CLOUD_TASKS_ENVIRONMENT.GCP_TASKS_SERVICE_ACCOUNT_EMAIL,
        email_verified: true,
      }),
    });
    const wrongIdentityRuntime = createExampleJobsRuntime({
      cloudTasksClient: {
        createTask: async (): Promise<[GcpCreateTaskResponse]> => [{}],
        queuePath: (): string => "queue",
      },
      environment: CLOUD_TASKS_ENVIRONMENT,
      idTokenVerifier: createVerifier({
        email: "other@example-project.iam.gserviceaccount.com",
        email_verified: true,
      }),
    });

    assert.isTrue(await validRuntime.executeAuth?.(createRequest("Bearer valid-token")));
    assert.isFalse(await validRuntime.executeAuth?.(createRequest()));
    assert.isFalse(await wrongIdentityRuntime.executeAuth?.(createRequest("Bearer valid-token")));
  });
});
