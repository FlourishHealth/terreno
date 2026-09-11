import {afterEach, describe, it} from "bun:test";
import {assert} from "chai";

import {registerJobsWorkerShutdown, resetJobsWorkerShutdownHooks} from "./shutdownJobsWorker";

describe("registerJobsWorkerShutdown", () => {
  const originalOnce = process.once.bind(process);

  afterEach((): void => {
    process.once = originalOnce;
    resetJobsWorkerShutdownHooks();
  });

  it("registers SIGTERM and SIGINT once and stops the worker", async (): Promise<void> => {
    const attached: Array<{event: string; listener: () => void}> = [];
    process.once = ((event: string, listener: () => void) => {
      attached.push({event, listener});
      return process;
    }) as typeof process.once;

    let stopCalls = 0;
    const jobsApp = {
      stopWorker: async (): Promise<void> => {
        stopCalls += 1;
      },
    };

    registerJobsWorkerShutdown(jobsApp as never);
    registerJobsWorkerShutdown(jobsApp as never);

    assert.deepEqual(
      attached.map((entry) => entry.event),
      ["SIGTERM", "SIGINT"]
    );

    attached[0]?.listener();
    await Bun.sleep(20);
    assert.equal(stopCalls, 1);
  });

  it("logs when stopWorker rejects during shutdown", async (): Promise<void> => {
    const attached: Array<{event: string; listener: () => void}> = [];
    process.once = ((event: string, listener: () => void) => {
      attached.push({event, listener});
      return process;
    }) as typeof process.once;

    const jobsApp = {
      stopWorker: async (): Promise<void> => {
        throw new Error("stop failed");
      },
    };

    registerJobsWorkerShutdown(jobsApp as never);
    attached.find((entry) => entry.event === "SIGINT")?.listener();
    await Bun.sleep(20);
  });

  it("stringifies non-Error stopWorker failures", async (): Promise<void> => {
    const attached: Array<{event: string; listener: () => void}> = [];
    process.once = ((event: string, listener: () => void) => {
      attached.push({event, listener});
      return process;
    }) as typeof process.once;

    const jobsApp = {
      stopWorker: async (): Promise<void> => {
        throw "stop failed";
      },
    };

    registerJobsWorkerShutdown(jobsApp as never);
    attached.find((entry) => entry.event === "SIGTERM")?.listener();
    await Bun.sleep(20);
  });
});
