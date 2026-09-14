import {describe, expect, it} from "bun:test";
import {DateTime} from "luxon";

import {docMatchesMutationData} from "./mutationHandler";

describe("docMatchesMutationData date compare", () => {
  it("treats date-only ISO strings as UTC midnight like Date parsing", () => {
    const stored = DateTime.fromISO("2024-01-15T00:00:00.000Z", {zone: "utc"}).toJSDate();
    expect(docMatchesMutationData({due: stored}, {due: "2024-01-15"})).toBe(true);
  });

  it("returns false for invalid date strings instead of throwing", () => {
    const stored = DateTime.fromISO("2024-01-15T00:00:00.000Z", {zone: "utc"}).toJSDate();
    expect(docMatchesMutationData({due: stored}, {due: "not-a-date"})).toBe(false);
  });
});
