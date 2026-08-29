import {describe, expect, it} from "bun:test";
import {
  parseCommsDashboardSearchParams,
  serializeCommsDashboardSearchParams,
} from "./commsDashboardParams";
import {summarizeSkippedReasons} from "./commsRetrySummary";
import {unwrapCommsMessage} from "./useCommsDashboardApi";

describe("commsDashboardParams", () => {
  it("round-trips filters through the URL query object", () => {
    const filters = {
      channel: "mail",
      endDate: "2026-08-20T00:00:00.000Z",
      errorClass: "transient",
      page: 3,
      provider: "sendgrid",
      q: "timeout",
      startDate: "2026-08-13T00:00:00.000Z",
      status: "failed",
    };
    const serialized = serializeCommsDashboardSearchParams(filters);
    expect(parseCommsDashboardSearchParams(serialized)).toEqual(filters);
  });

  it("drops empty values and page 1 from the URL", () => {
    expect(
      serializeCommsDashboardSearchParams({
        channel: "",
        page: 1,
        q: "  ",
      })
    ).toEqual({});
  });

  it("reads the first value when expo-router supplies arrays", () => {
    expect(
      parseCommsDashboardSearchParams({
        channel: ["sms", "mail"],
        page: ["2"],
      })
    ).toEqual({
      channel: "sms",
      endDate: undefined,
      errorClass: undefined,
      page: 2,
      provider: undefined,
      q: undefined,
      startDate: undefined,
      status: undefined,
    });
  });
});

describe("unwrapCommsMessage", () => {
  it("accepts both Better Auth unwrapped rows and {data} envelopes", () => {
    expect(unwrapCommsMessage({_id: "a", channel: "mail"})?._id).toBe("a");
    expect(unwrapCommsMessage({data: {channel: "sms", id: "b"}})?._id).toBe("b");
  });
});

describe("summarizeSkippedReasons", () => {
  it("groups skipped retry reasons for the result toast", () => {
    expect(summarizeSkippedReasons([])).toBe("none skipped");
    expect(
      summarizeSkippedReasons([
        {id: "a", reason: "Permanent failures cannot be retried"},
        {id: "b", reason: "Permanent failures cannot be retried"},
        {id: "c", reason: "Verification messages are not retryable"},
      ])
    ).toBe("2× Permanent failures cannot be retried; 1× Verification messages are not retryable");
  });
});
