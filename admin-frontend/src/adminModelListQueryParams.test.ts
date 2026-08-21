import {describe, expect, it} from "bun:test";
import {assert} from "chai";

import {
  adminFilterStateHasValues,
  areAdminFilterStatesEqual,
  buildAdminListQueryParams,
  compactAdminFilterState,
} from "./adminModelListQueryParams";
import type {AdminModelConfig} from "./types";

const todoConfig = {
  filters: [{field: "completed", kind: "boolean", label: "Completed"}],
  searchFields: ["title"],
} as AdminModelConfig;

describe("compactAdminFilterState", () => {
  it("drops undefined, empty string, and all", () => {
    expect(
      compactAdminFilterState({
        active: false,
        completed: undefined,
        name: "",
        role: "all",
        title: "  ",
      })
    ).toEqual({active: false});
  });
});

describe("areAdminFilterStatesEqual", () => {
  it("treats empty keys as equal to a missing applied state", () => {
    expect(areAdminFilterStatesEqual({completed: undefined}, {})).toBe(true);
    expect(areAdminFilterStatesEqual({completed: true}, {})).toBe(false);
  });
});

describe("adminFilterStateHasValues", () => {
  it("is false for an empty draft", () => {
    expect(adminFilterStateHasValues({})).toBe(false);
    expect(adminFilterStateHasValues({completed: undefined})).toBe(false);
  });
});

describe("buildAdminListQueryParams", () => {
  it("sends q for case-insensitive partial search instead of an exact field match", () => {
    const params = buildAdminListQueryParams({
      filterState: {},
      limit: 25,
      modelConfig: todoConfig,
      page: 1,
      searchDebounced: "TASK",
    });
    assert.equal(params.q, "TASK");
    assert.isUndefined(params.title);
  });

  it("omits q when search is blank", () => {
    const params = buildAdminListQueryParams({
      filterState: {completed: true},
      limit: 25,
      modelConfig: todoConfig,
      page: 1,
      searchDebounced: "  ",
    });
    assert.isUndefined(params.q);
    assert.equal(params.completed, true);
  });
});
