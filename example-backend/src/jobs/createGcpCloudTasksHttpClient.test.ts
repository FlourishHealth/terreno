import {describe, it, mock} from "bun:test";
import {assert} from "chai";
import {DateTime} from "luxon";

mock.module("google-auth-library", () => ({
  GoogleAuth: class MockGoogleAuth {
    getClient = async (): Promise<{
      request: (options: {
        data: unknown;
        method: string;
        url: string;
      }) => Promise<{data: {name: string}}>;
    }> => ({
      request: async (options: {data: unknown; method: string; url: string}) => {
        assert.equal(options.method, "POST");
        assert.include(options.url, "/tasks");
        return {data: {name: "projects/p/locations/l/queues/q/tasks/default-auth"}};
      },
    });
  },
}));

import {createGcpCloudTasksHttpClient} from "./createGcpCloudTasksHttpClient";

interface CapturedCreateTaskCall {
  data?: unknown;
  url?: string;
}

describe("createGcpCloudTasksHttpClient", (): void => {
  it("POSTs the task to the Cloud Tasks REST parent and omits scheduleTime when due now", async (): Promise<void> => {
    let captured: CapturedCreateTaskCall = {};
    const client = createGcpCloudTasksHttpClient({
      getClient: async () => ({
        request: async (options) => {
          captured = {data: options.data, url: options.url};
          return {data: {name: "projects/p/locations/l/queues/q/tasks/t1"}};
        },
      }),
    });

    const [created] = await client.createTask({
      parent: "projects/p/locations/l/queues/q",
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: "https://tasks.example.com/jobs/execute",
        },
      },
    });

    assert.equal(created.name, "projects/p/locations/l/queues/q/tasks/t1");
    assert.equal(
      captured.url,
      "https://cloudtasks.googleapis.com/v2/projects/p/locations/l/queues/q/tasks"
    );
    assert.deepEqual(captured.data, {
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: "https://tasks.example.com/jobs/execute",
        },
      },
    });
  });

  it("forwards dispatchDeadline so Cloud Tasks waits past the 10-minute HTTP default", async (): Promise<void> => {
    let captured: CapturedCreateTaskCall = {};
    const client = createGcpCloudTasksHttpClient({
      getClient: async () => ({
        request: async (options) => {
          captured = {data: options.data, url: options.url};
          return {data: {name: "projects/p/locations/l/queues/q/tasks/t1"}};
        },
      }),
    });

    await client.createTask({
      parent: "projects/p/locations/l/queues/q",
      task: {
        dispatchDeadline: "1800s",
        httpRequest: {
          httpMethod: "POST",
          url: "https://tasks.example.com/jobs/execute",
        },
      },
    });

    assert.deepEqual(captured.data, {
      task: {
        dispatchDeadline: "1800s",
        httpRequest: {
          httpMethod: "POST",
          url: "https://tasks.example.com/jobs/execute",
        },
      },
    });
  });

  it("sends scheduleTime as UTC RFC3339 when the runner supplies seconds and nanos", async (): Promise<void> => {
    let captured: CapturedCreateTaskCall = {};
    const scheduled = DateTime.fromISO("2026-09-15T19:10:00.250Z", {zone: "utc"});
    const client = createGcpCloudTasksHttpClient({
      getClient: async () => ({
        request: async (options) => {
          captured = {data: options.data, url: options.url};
          return {data: {}};
        },
      }),
    });

    await client.createTask({
      parent: "projects/p/locations/l/queues/q",
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: "https://tasks.example.com/jobs/execute",
        },
        scheduleTime: {
          nanos: (scheduled.toMillis() % 1000) * 1_000_000,
          seconds: Math.floor(scheduled.toSeconds()),
        },
      },
    });

    assert.deepEqual(captured.data, {
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: "https://tasks.example.com/jobs/execute",
        },
        scheduleTime: "2026-09-15T19:10:00.250Z",
      },
    });
  });

  it("builds the queue parent path", (): void => {
    const client = createGcpCloudTasksHttpClient({
      getClient: async () => ({
        request: async () => ({data: {}}),
      }),
    });

    assert.equal(
      client.queuePath("my-project", "us-central1", "jobs"),
      "projects/my-project/locations/us-central1/queues/jobs"
    );
  });

  it("uses GoogleAuth default credentials when no auth seam is injected", async (): Promise<void> => {
    const client = createGcpCloudTasksHttpClient();
    const [created] = await client.createTask({
      parent: "projects/p/locations/l/queues/q",
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: "https://tasks.example.com/jobs/execute",
        },
        scheduleTime: {
          seconds: Math.floor(DateTime.fromISO("2026-09-15T19:10:00Z", {zone: "utc"}).toSeconds()),
        },
      },
    });

    assert.equal(created.name, "projects/p/locations/l/queues/q/tasks/default-auth");
  });
});
