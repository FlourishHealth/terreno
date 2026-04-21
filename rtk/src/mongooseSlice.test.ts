import {describe, expect, it} from "bun:test";

import {type ListResponse, populateId} from "./mongooseSlice";

describe("populateId", () => {
  const items = [
    {_id: "a", name: "alpha"},
    {_id: "b", name: "beta"},
    {_id: "c", name: "gamma"},
  ];
  const response: ListResponse<(typeof items)[number]> = {
    data: items,
    limit: 10,
    more: false,
    page: 1,
    total: items.length,
  };

  it("returns the matching object by id", () => {
    expect(populateId("b", response)).toEqual({_id: "b", name: "beta"});
  });

  it("returns undefined when id is missing", () => {
    expect(populateId(undefined, response)).toBeUndefined();
  });

  it("returns undefined when objs is missing", () => {
    expect(populateId("a")).toBeUndefined();
  });

  it("returns undefined when objs has no data", () => {
    expect(populateId("a", {})).toBeUndefined();
  });

  it("returns undefined when no item matches", () => {
    expect(populateId("z", response)).toBeUndefined();
  });

  it("handles sparse arrays without throwing", () => {
    const sparse: ListResponse<{_id: string}> = {
      // biome-ignore lint/suspicious/noExplicitAny: Simulating malformed API payloads.
      data: [undefined as any, {_id: "found"}],
    };
    expect(populateId("found", sparse)).toEqual({_id: "found"});
  });
});
