import {describe, expect, it} from "bun:test";
import {assert} from "chai";
import {canCancelJob, canRequeueJob, canRetryJob} from "./jobPayload";
import {
  parseJobsDashboardSearchParams,
  serializeJobsDashboardSearchParams,
} from "./jobsDashboardParams";

describe("jobsDashboardParams", () => {
  it("round-trips filter params including scheduleId", () => {
    const parsed = parseJobsDashboardSearchParams({
      end: "2026-01-02T00:00:00.000Z",
      name: "nightly",
      page: "2",
      q: "boom",
      scheduleId: "507f1f77bcf86cd799439011",
      start: "2026-01-01T00:00:00.000Z",
      status: "dead",
    });
    assert.deepEqual(parsed, {
      end: "2026-01-02T00:00:00.000Z",
      name: "nightly",
      page: 2,
      q: "boom",
      scheduleId: "507f1f77bcf86cd799439011",
      start: "2026-01-01T00:00:00.000Z",
      status: "dead",
    });
    assert.deepEqual(serializeJobsDashboardSearchParams(parsed), {
      end: "2026-01-02T00:00:00.000Z",
      name: "nightly",
      page: "2",
      q: "boom",
      scheduleId: "507f1f77bcf86cd799439011",
      start: "2026-01-01T00:00:00.000Z",
      status: "dead",
    });
  });

  it("round-trips filter params", () => {
    const parsed = parseJobsDashboardSearchParams({
      end: "2026-01-02T00:00:00.000Z",
      name: "nightly",
      page: "2",
      q: "boom",
      start: "2026-01-01T00:00:00.000Z",
      status: "dead",
    });
    assert.deepEqual(parsed, {
      end: "2026-01-02T00:00:00.000Z",
      name: "nightly",
      page: 2,
      q: "boom",
      start: "2026-01-01T00:00:00.000Z",
      status: "dead",
    });
    assert.deepEqual(serializeJobsDashboardSearchParams(parsed), {
      end: "2026-01-02T00:00:00.000Z",
      name: "nightly",
      page: "2",
      q: "boom",
      start: "2026-01-01T00:00:00.000Z",
      status: "dead",
    });
  });

  it("drops empty strings and invalid page values", () => {
    expect(parseJobsDashboardSearchParams({page: "0", status: "  "})).toEqual({});
  });
});

describe("job action helpers", () => {
  it("gates retry, requeue, and cancel by status", () => {
    expect(canRetryJob({name: "a", status: "failed"})).toBe(true);
    expect(canRetryJob({name: "a", retriedById: "x", status: "failed"})).toBe(false);
    expect(canRequeueJob({name: "a", status: "cancelled"})).toBe(true);
    expect(canCancelJob({name: "a", status: "running"})).toBe(true);
    expect(canCancelJob({name: "a", status: "dead"})).toBe(false);
  });
});
