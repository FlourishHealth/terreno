import {beforeEach, describe, it} from "bun:test";
import {setupDb} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";

import {JobSchedule} from "../models/jobSchedule";

const SCHEDULE_FIELDS = [
  "cron",
  "enabled",
  "handlerName",
  "name",
  "nextRunAt",
  "timezone",
] as const;

describe("JobSchedule model", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await JobSchedule.deleteMany({});
  });

  it("persists a schedule row with documented schema fields", async (): Promise<void> => {
    const nextRunAt = DateTime.utc().plus({hours: 1}).toJSDate();
    const schedule = await JobSchedule.create({
      cron: "0 9 * * *",
      enabled: true,
      handlerName: "daily-report",
      name: "daily-report",
      nextRunAt,
      timezone: "UTC",
    });

    assert.equal(schedule.handlerName, "daily-report");
    assert.equal(await JobSchedule.countDocuments(), 1);

    for (const field of SCHEDULE_FIELDS) {
      assert.isString(
        JobSchedule.schema.path(field).options.description,
        `missing description on ${field}`
      );
    }
  });
});
