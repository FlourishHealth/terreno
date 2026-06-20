import {describe, expect, test} from "bun:test";

import {
  databaseQuery,
  databaseQueryFilterUsesForbiddenOperators,
} from "../local/tools/databaseQuery.js";

describe("databaseQuery filter safety", () => {
  test("allows empty filter and simple equality", () => {
    expect(databaseQueryFilterUsesForbiddenOperators({})).toBe(false);
    expect(databaseQueryFilterUsesForbiddenOperators({status: "active"})).toBe(false);
    expect(databaseQueryFilterUsesForbiddenOperators({$and: [{a: 1}, {b: 2}]})).toBe(false);
  });

  test("rejects $where at top level", () => {
    expect(databaseQueryFilterUsesForbiddenOperators({$where: "1==1"})).toBe(true);
  });

  test("rejects $where nested in $or", () => {
    expect(
      databaseQueryFilterUsesForbiddenOperators({
        $or: [{name: "x"}, {$where: "this.name.length > 0"}],
      })
    ).toBe(true);
  });

  test("rejects $function", () => {
    expect(
      databaseQueryFilterUsesForbiddenOperators({
        $expr: {
          $function: {
            args: [],
            body: "function() {}",
            lang: "js",
          },
        },
      })
    ).toBe(true);
  });

  test("rejects $accumulator", () => {
    expect(databaseQueryFilterUsesForbiddenOperators({$accumulator: {}})).toBe(true);
  });
});

describe("databaseQuery", () => {
  test("rejects unsupported operation without touching Mongo", async () => {
    const msg = await databaseQuery({collection: "users", operation: "deleteMany"});
    expect(msg).toContain("Unsupported operation");
  });

  test("rejects forbidden find filter before requiring Mongo URI", async () => {
    const msg = await databaseQuery({
      collection: "users",
      filter: {$where: "0"},
      operation: "find",
    });
    expect(msg).toContain("Filter rejected");
  });

  test("rejects aggregate pipeline that is not an array before Mongo", async () => {
    const msg = await databaseQuery({
      collection: "users",
      operation: "aggregate",
      pipeline: {$match: {}} as unknown as unknown[],
    });
    expect(msg).toContain("pipeline` must be an array");
  });

  test("rejects forbidden aggregate stages before Mongo", async () => {
    const msg = await databaseQuery({
      collection: "users",
      operation: "aggregate",
      pipeline: [{$out: "other"}],
    });
    expect(msg).toContain("Pipeline rejected");
  });

  test("requires field for distinct before Mongo", async () => {
    const msg = await databaseQuery({
      collection: "users",
      field: "",
      operation: "distinct",
    });
    expect(msg).toContain("`field` is required");
  });

  test("returns guidance when Mongo URI is missing after validations pass", async () => {
    const prior = process.env.MONGO_URI;
    delete process.env.MONGO_URI;
    const msg = await databaseQuery({
      collection: "users",
      filter: {a: 1},
      operation: "find",
    });
    if (prior !== undefined) {
      process.env.MONGO_URI = prior;
    }
    expect(msg).toContain("No Mongo URI found");
  });
});
