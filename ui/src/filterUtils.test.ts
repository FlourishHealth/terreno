import {describe, expect, it} from "bun:test";

import type {FilterDefinition} from "./Common";
import {
  clearFilterField,
  clearFilterValues,
  countActiveFilters,
  getActiveFilters,
  getDateRangeValue,
  getFilterLabel,
  getMultiChoiceValue,
  getNumberRangeValue,
  isFilterActive,
} from "./filterUtils";

const booleanFilter: FilterDefinition = {field: "completed", kind: "boolean"};
const choiceFilter: FilterDefinition = {
  field: "status",
  kind: "choice",
  options: [
    {label: "Open", value: "open"},
    {label: "Closed", value: "closed"},
  ],
};
const multiChoiceFilter: FilterDefinition = {
  field: "tags",
  kind: "multiChoice",
  options: [
    {label: "Urgent", value: "urgent"},
    {label: "Follow up", value: "followUp"},
  ],
};
const textFilter: FilterDefinition = {field: "title", kind: "text"};
const dateRangeFilter: FilterDefinition = {field: "created", kind: "dateRange"};
const numberRangeFilter: FilterDefinition = {field: "score", kind: "numberRange"};

const allFilters = [
  booleanFilter,
  choiceFilter,
  multiChoiceFilter,
  textFilter,
  dateRangeFilter,
  numberRangeFilter,
];

describe("getFilterLabel", () => {
  it("uses the explicit label when provided", () => {
    expect(getFilterLabel({field: "ownerId", kind: "text", label: "Owner"})).toBe("Owner");
  });

  it("title-cases the field when no label is provided", () => {
    expect(getFilterLabel({field: "createdAt", kind: "text"})).toBe("Created At");
  });
});

describe("isFilterActive", () => {
  it("treats an unset boolean as inactive and either explicit value as active", () => {
    expect(isFilterActive({definition: booleanFilter, value: undefined})).toBe(false);
    expect(isFilterActive({definition: booleanFilter, value: true})).toBe(true);
    expect(isFilterActive({definition: booleanFilter, value: false})).toBe(true);
  });

  it("treats blank strings as inactive for choice and text", () => {
    expect(isFilterActive({definition: choiceFilter, value: ""})).toBe(false);
    expect(isFilterActive({definition: textFilter, value: "   "})).toBe(false);
    expect(isFilterActive({definition: textFilter, value: "milk"})).toBe(true);
  });

  it("treats an empty selection as inactive for multiChoice", () => {
    expect(isFilterActive({definition: multiChoiceFilter, value: []})).toBe(false);
    expect(isFilterActive({definition: multiChoiceFilter, value: ["urgent"]})).toBe(true);
  });

  it("treats a half-open range as active", () => {
    expect(isFilterActive({definition: dateRangeFilter, value: {}})).toBe(false);
    expect(isFilterActive({definition: dateRangeFilter, value: {from: "2026-01-01"}})).toBe(true);
    expect(isFilterActive({definition: numberRangeFilter, value: {to: 10}})).toBe(true);
  });

  it("treats a zero bound as active rather than empty", () => {
    expect(isFilterActive({definition: numberRangeFilter, value: {from: 0}})).toBe(true);
  });
});

describe("getActiveFilters", () => {
  it("returns nothing when no filter has a value", () => {
    expect(getActiveFilters({filters: allFilters, values: {}})).toEqual([]);
    expect(countActiveFilters({filters: allFilters, values: {}})).toBe(0);
  });

  it("summarizes a boolean with its true and false labels", () => {
    const filters: FilterDefinition[] = [
      {falseLabel: "Pending", field: "completed", kind: "boolean", trueLabel: "Done"},
    ];
    expect(getActiveFilters({filters, values: {completed: true}})[0]).toEqual({
      field: "completed",
      label: "Completed",
      value: "Done",
    });
    expect(getActiveFilters({filters, values: {completed: false}})[0]?.value).toBe("Pending");
  });

  it("summarizes a choice using the matching option label", () => {
    expect(getActiveFilters({filters: [choiceFilter], values: {status: "closed"}})[0]).toEqual({
      field: "status",
      label: "Status",
      value: "Closed",
    });
  });

  it("falls back to the raw value when a choice has no matching option", () => {
    expect(
      getActiveFilters({filters: [choiceFilter], values: {status: "archived"}})[0]?.value
    ).toBe("archived");
  });

  it("returns one entry per selected multiChoice option", () => {
    const active = getActiveFilters({
      filters: [multiChoiceFilter],
      values: {tags: ["urgent", "followUp"]},
    });
    expect(active).toHaveLength(2);
    expect(active.map((entry) => entry.value)).toEqual(["Urgent", "Follow up"]);
    expect(active.map((entry) => entry.optionValue)).toEqual(["urgent", "followUp"]);
  });

  it("summarizes open-ended date ranges", () => {
    const from = getActiveFilters({
      filters: [dateRangeFilter],
      values: {created: {from: "2026-03-04"}},
    });
    expect(from[0]?.value).toBe("On or after Mar 4, 2026");

    const to = getActiveFilters({
      filters: [dateRangeFilter],
      values: {created: {to: "2026-03-04"}},
    });
    expect(to[0]?.value).toBe("On or before Mar 4, 2026");
  });

  // DateTimeField emits a date-only bound as UTC midnight. Formatting that in the device zone
  // (these tests run under TZ=America/New_York) labelled the previous day.
  it("labels a UTC-midnight date bound as the day that was picked", () => {
    const active = getActiveFilters({
      filters: [dateRangeFilter],
      values: {created: {from: "2026-03-04T00:00:00.000Z"}},
    });
    expect(active[0]?.value).toBe("On or after Mar 4, 2026");
  });

  it("summarizes a closed date range with both bounds", () => {
    const active = getActiveFilters({
      filters: [dateRangeFilter],
      values: {created: {from: "2026-03-04", to: "2026-03-08"}},
    });
    expect(active[0]?.value).toBe("Mar 4, 2026 – Mar 8, 2026");
  });

  it("summarizes number ranges", () => {
    expect(
      getActiveFilters({filters: [numberRangeFilter], values: {score: {from: 3}}})[0]?.value
    ).toBe("3 or more");
    expect(
      getActiveFilters({filters: [numberRangeFilter], values: {score: {to: 9}}})[0]?.value
    ).toBe("9 or less");
    expect(
      getActiveFilters({filters: [numberRangeFilter], values: {score: {from: 3, to: 9}}})[0]?.value
    ).toBe("3 – 9");
  });

  it("ignores values for fields with no matching definition", () => {
    expect(getActiveFilters({filters: [textFilter], values: {unknown: "value"}})).toEqual([]);
  });
});

describe("range and multiChoice readers", () => {
  it("ignores malformed values rather than throwing", () => {
    expect(getDateRangeValue("not-an-object")).toEqual({});
    expect(getDateRangeValue({from: 5} as never)).toEqual({from: undefined, to: undefined});
    expect(getNumberRangeValue({from: Number.NaN})).toEqual({from: undefined, to: undefined});
    expect(getMultiChoiceValue("urgent")).toEqual([]);
    expect(getMultiChoiceValue(["urgent", 3] as never)).toEqual(["urgent"]);
  });
});

describe("clearFilterValues", () => {
  it("resets every known field to its empty value", () => {
    const cleared = clearFilterValues({
      filters: allFilters,
      values: {
        completed: true,
        created: {from: "2026-01-01"},
        score: {from: 1, to: 2},
        status: "open",
        tags: ["urgent"],
        title: "milk",
      },
    });
    expect(cleared).toEqual({
      completed: undefined,
      created: {},
      score: {},
      status: "",
      tags: [],
      title: "",
    });
    expect(countActiveFilters({filters: allFilters, values: cleared})).toBe(0);
  });

  it("leaves keys the component does not own untouched", () => {
    const cleared = clearFilterValues({filters: [textFilter], values: {page: "2", title: "milk"}});
    expect(cleared.page).toBe("2");
  });

  it("preserves a disabled filter, which the user cannot edit anyway", () => {
    const cleared = clearFilterValues({
      filters: [{...choiceFilter, disabled: true}, textFilter],
      values: {status: "open", title: "milk"},
    });
    expect(cleared).toEqual({status: "open", title: ""});
  });
});

describe("clearFilterField", () => {
  it("clears a single field", () => {
    expect(
      clearFilterField({
        definition: choiceFilter,
        values: {status: "open", title: "milk"},
      })
    ).toEqual({status: "", title: "milk"});
  });

  it("removes only the named option from a multiChoice field", () => {
    expect(
      clearFilterField({
        definition: multiChoiceFilter,
        optionValue: "urgent",
        values: {tags: ["urgent", "followUp"]},
      })
    ).toEqual({tags: ["followUp"]});
  });

  it("clears the whole multiChoice field when no option is named", () => {
    expect(
      clearFilterField({definition: multiChoiceFilter, values: {tags: ["urgent", "followUp"]}})
    ).toEqual({tags: []});
  });
});
