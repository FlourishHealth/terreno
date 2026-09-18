import {describe, it} from "bun:test";
import {assert} from "chai";

import {runStandaloneJobsWorker} from "./jobsWorker";

describe("runStandaloneJobsWorker", () => {
  it("starts the bootstrap path without exiting", async (): Promise<void> => {
    let bootstrapped = false;
    let exitCode: number | undefined;

    await runStandaloneJobsWorker({
      bootstrap: async () => {
        bootstrapped = true;
        return {} as never;
      },
      exitProcess: (code) => {
        exitCode = code;
      },
    });

    assert.isTrue(bootstrapped);
    assert.equal(exitCode, undefined);
  });

  it("exits 1 when bootstrap throws a non-Error value", async (): Promise<void> => {
    let exitCode: number | undefined;

    await runStandaloneJobsWorker({
      bootstrap: async () => {
        throw "boom";
      },
      exitProcess: (code) => {
        exitCode = code;
      },
    });

    assert.equal(exitCode, 1);
  });
});
