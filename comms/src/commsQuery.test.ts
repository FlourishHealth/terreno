import {describe, it} from "bun:test";
import {assert} from "chai";
import {DateTime} from "luxon";
import mongoose from "mongoose";

import {
  buildCommsMessageMatch,
  defaultStatsRange,
  parseCommsListFilters,
  parseCommsListPagination,
  parseRetryManyLimit,
} from "./commsQuery";

describe("parseCommsListFilters", () => {
  it("trims strings and drops blank or non-string values", () => {
    const filters = parseCommsListFilters({
      channel: "  mail  ",
      errorClass: "",
      provider: ["sendgrid"],
      q: "   ",
      status: "failed",
      to: 1234,
    });
    assert.equal(filters.channel, "mail");
    assert.equal(filters.status, "failed");
    assert.isUndefined(filters.errorClass);
    assert.isUndefined(filters.provider);
    assert.isUndefined(filters.q);
    assert.isUndefined(filters.to);
  });
});

describe("parseCommsListPagination", () => {
  it("defaults to page 1 with a 20 row limit", () => {
    assert.deepEqual(parseCommsListPagination({}), {limit: 20, page: 1, skip: 0});
  });

  it("computes skip and clamps the limit to 100", () => {
    assert.deepEqual(parseCommsListPagination({limit: "10", page: "3"}), {
      limit: 10,
      page: 3,
      skip: 20,
    });
    assert.deepEqual(parseCommsListPagination({limit: "5000", page: "-4"}), {
      limit: 100,
      page: 1,
      skip: 0,
    });
  });
});

describe("parseRetryManyLimit", () => {
  it("falls back to the cap and clamps out-of-range values", () => {
    assert.equal(parseRetryManyLimit(undefined), 100);
    assert.equal(parseRetryManyLimit("not-a-number"), 100);
    assert.equal(parseRetryManyLimit("250"), 100);
    assert.equal(parseRetryManyLimit("0"), 1);
    assert.equal(parseRetryManyLimit("25"), 25);
  });
});

describe("defaultStatsRange", () => {
  it("spans the trailing seven days", () => {
    const {endDate, startDate} = defaultStatsRange();
    assert.equal(Math.round(endDate.diff(startDate, "days").days), 7);
  });
});

describe("buildCommsMessageMatch", () => {
  it("always excludes soft-deleted rows", () => {
    assert.deepEqual(buildCommsMessageMatch({}), {deleted: {$ne: true}});
  });

  it("maps scalar filters straight through", () => {
    const match = buildCommsMessageMatch({
      channel: "mail",
      errorClass: "transient",
      errorCode: "timeout",
      provider: "sendgrid",
      status: "failed",
      templateId: "welcome",
      to: "a***@example.com",
    });
    assert.equal(match.channel, "mail");
    assert.equal(match.errorClass, "transient");
    assert.equal(match.errorCode, "timeout");
    assert.equal(match.provider, "sendgrid");
    assert.equal(match.status, "failed");
    assert.equal(match.templateId, "welcome");
    assert.equal(match.to, "a***@example.com");
  });

  it("casts id filters and rejects malformed ones", () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const retriedFromId = new mongoose.Types.ObjectId().toString();
    const match = buildCommsMessageMatch({retriedFromId, userId});
    assert.equal(String(match.userId), userId);
    assert.equal(String(match.retriedFromId), retriedFromId);

    assert.throws(() => buildCommsMessageMatch({userId: "nope"}), /Invalid userId/);
    assert.throws(() => buildCommsMessageMatch({retriedFromId: "nope"}), /Invalid retriedFromId/);
  });

  it("builds created bounds from either end of the range", () => {
    const startOnly = buildCommsMessageMatch({startDate: "2026-08-01T00:00:00.000Z"}) as {
      created: {$gte?: Date; $lte?: Date};
    };
    assert.instanceOf(startOnly.created.$gte, Date);
    assert.isUndefined(startOnly.created.$lte);

    const endOnly = buildCommsMessageMatch({endDate: "2026-08-31T00:00:00.000Z"}) as {
      created: {$gte?: Date; $lte?: Date};
    };
    assert.instanceOf(endOnly.created.$lte, Date);
    assert.isUndefined(endOnly.created.$gte);
  });

  it("rejects invalid dates and inverted ranges", () => {
    assert.throws(() => buildCommsMessageMatch({startDate: "yesterday"}), /Invalid startDate/);
    assert.throws(() => buildCommsMessageMatch({endDate: "soon"}), /Invalid endDate/);
    assert.throws(
      () =>
        buildCommsMessageMatch({
          endDate: "2026-08-01T00:00:00.000Z",
          startDate: "2026-08-31T00:00:00.000Z",
        }),
      /startDate must not be after endDate/
    );
  });

  it("applies the default stats range only when both bounds are absent", () => {
    const defaulted = buildCommsMessageMatch({}, {applyDefaultStatsRange: true}) as {
      created: {$gte: Date; $lte: Date};
    };
    const spanDays = DateTime.fromJSDate(defaulted.created.$lte).diff(
      DateTime.fromJSDate(defaulted.created.$gte),
      "days"
    ).days;
    assert.equal(Math.round(spanDays), 7);

    const explicit = buildCommsMessageMatch(
      {startDate: "2026-08-01T00:00:00.000Z"},
      {applyDefaultStatsRange: true}
    ) as {created: {$gte: Date; $lte?: Date}};
    assert.isUndefined(explicit.created.$lte);
  });

  it("searches subject, error, and recipient, escaping regex metacharacters", () => {
    const match = buildCommsMessageMatch({q: "a.b*c"}) as {
      $or: Array<Record<string, {$regex: string}>>;
    };
    assert.lengthOf(match.$or, 3);
    assert.equal(match.$or[0].subject.$regex, "a\\.b\\*c");
    assert.equal(match.$or[1].error.$regex, "a\\.b\\*c");
    assert.equal(match.$or[2].to.$regex, "a\\.b\\*c");
  });

  it("adds a last-4 suffix clause for redacted destinations", () => {
    const match = buildCommsMessageMatch({q: "1234"}) as {
      $or: Array<Record<string, {$regex: string}>>;
    };
    assert.lengthOf(match.$or, 4);
    assert.equal(match.$or[3].to.$regex, "1234$");
  });
});
