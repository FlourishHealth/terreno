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

  it("includes sort, dateRange bounds, choice/text/ref filters, and skips empty values", () => {
    const modelConfig = {
      filters: [
        {field: "created", kind: "dateRange"},
        {field: "status", kind: "choice"},
        {field: "title", kind: "text"},
        {field: "ownerId", kind: "ref"},
        {field: "completed", kind: "boolean"},
      ],
      searchFields: ["title"],
    } as AdminModelConfig;
    const params = buildAdminListQueryParams({
      filterState: {
        completed: "all",
        created_gte: "2026-01-01",
        created_lte: " 2026-01-31 ",
        ownerId: "abc",
        status: "open",
        title: "hello",
      },
      limit: 10,
      modelConfig,
      page: 2,
      searchDebounced: "q",
      sort: "-created",
    });
    assert.equal(params.sort, "-created");
    assert.equal(params.created_gte, "2026-01-01");
    assert.equal(params.created_lte, "2026-01-31");
    assert.equal(params.status, "open");
    assert.equal(params.title, "hello");
    assert.equal(params.ownerId, "abc");
    assert.equal(params.q, "q");
    assert.isUndefined(params.completed);
  });

  it("coerces boolean filters and skips blank date bounds", () => {
    const modelConfig = {
      filters: [
        {field: "completed", kind: "boolean"},
        {field: "created", kind: "dateRange"},
      ],
    } as AdminModelConfig;
    const params = buildAdminListQueryParams({
      filterState: {
        completed: "true",
        created_gte: "  ",
        created_lte: undefined,
      },
      limit: 10,
      modelConfig,
      page: 1,
      searchDebounced: "",
    });
    assert.equal(params.completed, true);
    assert.isUndefined(params.created_gte);
    assert.isUndefined(params.created_lte);
  });
});
