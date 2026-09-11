import {describe, it} from "bun:test";
import {assert} from "chai";

import {parseJobsStartWorkerEnv, shouldStartJobsWorkerInApiProcess} from "./jobsStartWorker";

describe("jobsStartWorker env parsing", () => {
  it("defaults to true when JOBS_START_WORKER is unset", () => {
    assert.isTrue(parseJobsStartWorkerEnv(undefined));
    assert.isTrue(parseJobsStartWorkerEnv(""));
    assert.isTrue(parseJobsStartWorkerEnv("   "));
  });

  it("parses explicit true and false case-insensitively", () => {
    assert.isTrue(parseJobsStartWorkerEnv("true"));
    assert.isTrue(parseJobsStartWorkerEnv("TRUE"));
    assert.isFalse(parseJobsStartWorkerEnv("false"));
    assert.isFalse(parseJobsStartWorkerEnv("FALSE"));
  });

  it("does not start in the API process when skipListen is true", () => {
    assert.isFalse(
      shouldStartJobsWorkerInApiProcess({jobsStartWorkerEnv: "true", skipListen: true})
    );
    assert.isFalse(
      shouldStartJobsWorkerInApiProcess({jobsStartWorkerEnv: undefined, skipListen: true})
    );
  });

  it("warns and defaults to true for unrecognized JOBS_START_WORKER values", () => {
    assert.isTrue(parseJobsStartWorkerEnv("sometimes"));
    assert.isTrue(shouldStartJobsWorkerInApiProcess({jobsStartWorkerEnv: "1", skipListen: false}));
  });

  it("honors JOBS_START_WORKER=false when the server listens", () => {
    assert.isFalse(
      shouldStartJobsWorkerInApiProcess({jobsStartWorkerEnv: "false", skipListen: false})
    );
    assert.isTrue(
      shouldStartJobsWorkerInApiProcess({jobsStartWorkerEnv: "true", skipListen: false})
    );
    assert.isTrue(
      shouldStartJobsWorkerInApiProcess({jobsStartWorkerEnv: undefined, skipListen: false})
    );
  });
});
