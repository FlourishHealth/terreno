import {describe, it} from "bun:test";
import {isAPIError} from "@terreno/api";
import {assert} from "chai";
import {DateTime} from "luxon";

import {
  assertValidCronExpression,
  assertValidIanaTimezone,
  computeInitialNextRunAt,
  computeNextRunAtAfter,
  resolveScheduleTimezone,
  validateScheduleDefinition,
} from "../scheduleCron";

describe("scheduleCron", () => {
  it("computes different next runs for America/New_York vs UTC", (): void => {
    const cron = "0 9 * * *";
    const utcNext = computeInitialNextRunAt(cron, "UTC");
    const newYorkNext = computeInitialNextRunAt(cron, "America/New_York");

    assert.notEqual(utcNext.toISOString(), newYorkNext.toISOString());
    assert.equal(
      DateTime.fromJSDate(newYorkNext).setZone("America/New_York").hour,
      9,
      "New York schedule fires at 9am local"
    );
    assert.equal(
      DateTime.fromJSDate(utcNext).setZone("UTC").hour,
      9,
      "UTC schedule fires at 9am UTC"
    );
  });

  it("advances nextRunAt after a tick using the schedule timezone", (): void => {
    const cron = "0 9 * * *";
    const after = new Date("2026-09-10T14:00:00.000Z");
    const utcNext = computeNextRunAtAfter(cron, "UTC", after);
    const newYorkNext = computeNextRunAtAfter(cron, "America/New_York", after);

    assert.equal(utcNext.toISOString(), "2026-09-11T09:00:00.000Z");
    assert.equal(newYorkNext.toISOString(), "2026-09-11T13:00:00.000Z");
  });

  it("defaults schedule timezone resolution to JobsApp timezone then UTC", (): void => {
    assert.equal(
      resolveScheduleTimezone({defaultTimezone: "America/Chicago", scheduleTimezone: undefined}),
      "America/Chicago"
    );
    assert.equal(resolveScheduleTimezone({defaultTimezone: "America/Chicago"}), "America/Chicago");
    assert.equal(
      resolveScheduleTimezone({
        defaultTimezone: "America/Chicago",
        scheduleTimezone: "America/New_York",
      }),
      "America/New_York"
    );
  });

  it("rejects invalid cron expressions at define time", (): void => {
    try {
      assertValidCronExpression("not-a-cron", "UTC");
      assert.fail("expected invalid cron to throw");
    } catch (error: unknown) {
      assert.isTrue(isAPIError(error));
      assert.equal((error as {status: number}).status, 400);
    }
  });

  it("rejects invalid IANA timezones at define time", (): void => {
    try {
      assertValidIanaTimezone("Not/A_Zone");
      assert.fail("expected invalid timezone to throw");
    } catch (error: unknown) {
      assert.isTrue(isAPIError(error));
      assert.equal((error as {status: number}).status, 400);
    }
  });

  it("validateScheduleDefinition applies definition timezone over JobsApp default", (): void => {
    const timezone = validateScheduleDefinition({
      cron: "0 9 * * *",
      defaultTimezone: "UTC",
      scheduleTimezone: "America/New_York",
    });
    assert.equal(timezone, "America/New_York");
  });
});
