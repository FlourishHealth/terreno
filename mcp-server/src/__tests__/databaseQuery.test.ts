import {describe, expect, test} from "bun:test";

import {databaseQueryFilterUsesForbiddenOperators} from "../local/tools/databaseQuery.js";

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
