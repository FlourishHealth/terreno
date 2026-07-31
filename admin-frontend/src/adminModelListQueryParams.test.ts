import {describe, expect, it} from "bun:test";
import {DateTime} from "luxon";

import {buildAdminFilterDefinitions, buildAdminListQueryParams} from "./adminModelListQueryParams";
import type {AdminModelConfig} from "./types";

const modelConfig = {
  defaultSort: "-created",
  displayName: "Todos",
  fields: {},
  filters: [
    {field: "completed", kind: "boolean", label: "Completed"},
    {
      choices: [
        {label: "Low", value: "low"},
        {label: "High", value: "high"},
      ],
      field: "priority",
      kind: "choice",
    },
    {field: "created", kind: "dateRange"},
    {field: "ownerId", kind: "ref", refModel: "User"},
    {field: "note", kind: "text"},
  ],
  listFields: ["title"],
  name: "Todo",
  routePath: "/todos",
  searchFields: ["title"],
} as unknown as AdminModelConfig;

const baseInput = {limit: 20, modelConfig, page: 1, searchDebounced: ""};

describe("buildAdminFilterDefinitions", () => {
  it("maps every backend filter kind to a Filter definition", () => {
    expect(buildAdminFilterDefinitions(modelConfig)).toEqual([
      {field: "completed", kind: "boolean", label: "Completed"},
      {
        field: "priority",
        kind: "choice",
        label: undefined,
        options: [
          {label: "Low", value: "low"},
          {label: "High", value: "high"},
        ],
      },
      {field: "created", kind: "dateRange", label: undefined, type: "date"},
      {field: "ownerId", helperText: "Object ID", kind: "text", label: undefined},
      {field: "note", kind: "text", label: undefined},
    ]);
  });

  it("returns an empty list when the model declares no filters", () => {
    expect(buildAdminFilterDefinitions({...modelConfig, filters: undefined})).toEqual([]);
  });

  it("tolerates a choice filter with no choices", () => {
    const config = {
      ...modelConfig,
      filters: [{field: "priority", kind: "choice"}],
    } as unknown as AdminModelConfig;
    expect(buildAdminFilterDefinitions(config)[0]).toEqual({
      field: "priority",
      kind: "choice",
      label: undefined,
      options: [],
    });
  });
});

describe("buildAdminListQueryParams", () => {
  it("sends only paging when nothing is applied", () => {
    expect(buildAdminListQueryParams({...baseInput, filterState: {}})).toEqual({
      limit: 20,
      page: 1,
    });
  });

  it("sends both boolean states, including false", () => {
    expect(
      buildAdminListQueryParams({...baseInput, filterState: {completed: false}}).completed
    ).toBe(false);
    expect(
      buildAdminListQueryParams({...baseInput, filterState: {completed: true}}).completed
    ).toBe(true);
  });

  it("omits an unset boolean", () => {
    expect(
      buildAdminListQueryParams({...baseInput, filterState: {completed: undefined}})
    ).not.toHaveProperty("completed");
  });

  it("expands a date range into _gte and _lte", () => {
    const params = buildAdminListQueryParams({
      ...baseInput,
      filterState: {created: {from: "2026-01-01T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z"}},
    });
    expect(params.created_gte).toBe("2026-01-01T00:00:00.000Z");
    expect(params.created_lte).toBeTruthy();
  });

  // The date picker emits midnight, so a raw _lte would exclude every record later that day.
  it("widens a date-only upper bound to the end of the picked day", () => {
    const params = buildAdminListQueryParams({
      ...baseInput,
      filterState: {created: {to: "2026-02-01T00:00:00.000Z"}},
    });
    expect(DateTime.fromISO(String(params.created_lte)).toUTC().toISO()).toBe(
      "2026-02-01T23:59:59.999Z"
    );
  });

  it("leaves an unparseable upper bound untouched", () => {
    expect(
      buildAdminListQueryParams({...baseInput, filterState: {created: {to: "not-a-date"}}})
        .created_lte
    ).toBe("not-a-date");
  });

  it("sends only the bound that is set for an open-ended range", () => {
    const params = buildAdminListQueryParams({
      ...baseInput,
      filterState: {created: {from: "2026-01-01T00:00:00.000Z"}},
    });
    expect(params.created_gte).toBe("2026-01-01T00:00:00.000Z");
    expect(params).not.toHaveProperty("created_lte");
  });

  it("trims and drops blank strings", () => {
    const params = buildAdminListQueryParams({
      ...baseInput,
      filterState: {note: "   ", priority: "  high  "},
    });
    expect(params.priority).toBe("high");
    expect(params).not.toHaveProperty("note");
  });

  it("sends the debounced search on the first search field", () => {
    expect(
      buildAdminListQueryParams({...baseInput, filterState: {}, searchDebounced: " milk "}).title
    ).toBe("milk");
  });

  it("includes the sort when provided", () => {
    expect(buildAdminListQueryParams({...baseInput, filterState: {}, sort: "-created"}).sort).toBe(
      "-created"
    );
  });

  it("ignores values whose field the model does not declare as a filter", () => {
    expect(
      buildAdminListQueryParams({...baseInput, filterState: {somethingElse: "value"}})
    ).toEqual({limit: 20, page: 1});
  });
});
