import {describe, it} from "bun:test";
import {assert} from "chai";
import {DateTime} from "luxon";
import {formatCommsTimestamp} from "./commsMessagePayload";

describe("formatCommsTimestamp", () => {
  it("prints a valid ISO timestamp in the local locale", () => {
    const value = "2026-08-20T00:00:00.000Z";
    const expected = DateTime.fromISO(value).toLocal().toLocaleString(DateTime.DATETIME_MED);
    assert.equal(formatCommsTimestamp({value}), expected);
    assert.notInclude(formatCommsTimestamp({value}), "T00:00:00");
  });

  it("returns the empty fallback when the value is missing", () => {
    assert.equal(formatCommsTimestamp({empty: "—"}), "—");
    assert.equal(formatCommsTimestamp({}), "");
  });

  it("keeps an unparseable string so a bad provider clock still shows", () => {
    assert.equal(formatCommsTimestamp({value: "not-a-timestamp"}), "not-a-timestamp");
  });
});
