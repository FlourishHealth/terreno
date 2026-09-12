import {beforeEach, describe, it} from "bun:test";
import {setupDb} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";

import {Job} from "../models/job";

const JOB_FIELDS = [
  "attemptCount",
  "attempts",
  "backoffMs",
  "idempotencyKey",
  "lastError",
  "lockedAt",
  "lockedBy",
  "maxAttempts",
  "maxBackoffMs",
  "name",
  "payload",
  "payloadRedacted",
  "retriedById",
  "retriedFromId",
  "runAt",
  "scheduleId",
  "status",
] as const;

describe("Job model", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Job.deleteMany({});
  });

  it("persists a pending row with documented schema fields", async (): Promise<void> => {
    const job = await Job.create({
      attemptCount: 0,
      maxAttempts: 5,
      name: "demo",
      payload: {userId: "abc"},
      payloadRedacted: true,
      runAt: DateTime.utc().toJSDate(),
      status: "pending",
    });

    assert.equal(job.status, "pending");
    assert.equal(await Job.countDocuments(), 1);

    for (const field of JOB_FIELDS) {
      assert.isString(
        Job.schema.path(field).options.description,
        `missing description on ${field}`
      );
    }

    const attemptAtPath = Job.schema.path("attempts") as {
      schema?: {path: (name: string) => {options: {description?: string}}};
    };
    assert.isString(attemptAtPath.schema?.path("at").options.description);
    assert.isString(attemptAtPath.schema?.path("error").options.description);
    assert.isString(attemptAtPath.schema?.path("errorClass").options.description);
  });
});
