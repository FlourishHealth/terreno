import {describe, expect, it} from "bun:test";

import type {DataTableColumn} from "./Common";
import {buildDataTableListQuery, escapeRegexLiteral} from "./dataTableListQuery";

describe("escapeRegexLiteral", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegexLiteral(".*")).toBe("\\.\\*");
  });
});

describe("buildDataTableListQuery", () => {
  const columns: DataTableColumn[] = [
    {
      columnType: "text",
      filter: {field: "name", kind: "text"},
      title: "Name",
      width: 100,
    },
    {
      columnType: "boolean",
      filter: {field: "active", kind: "boolean"},
      title: "Active",
      width: 80,
    },
    {
      columnType: "date",
      filter: {field: "created", kind: "dateRange"},
      title: "Created",
      width: 120,
    },
    {
      columnType: "number",
      filter: {field: "age", kind: "numberRange"},
      title: "Age",
      width: 80,
    },
    {
      columnType: "text",
      filter: {
        field: "role",
        kind: "choice",
        options: [{label: "Staff", value: "staff"}],
      },
      title: "Role",
      width: 100,
    },
  ];

  it("emits search $or with escaped regex across searchFields", () => {
    const params = buildDataTableListQuery({
      columns: [],
      search: ".*",
      searchFields: ["title", "name"],
    });
    expect(params.$or).toEqual([
      {title: {$options: "i", $regex: "\\.\\*"}},
      {name: {$options: "i", $regex: "\\.\\*"}},
    ]);
    expect(params.page).toBeUndefined();
    expect(params.sort).toBeUndefined();
  });

  it("omits boolean when unset and emits true when set", () => {
    expect(
      buildDataTableListQuery({
        columns,
        filterValues: {},
      }).active
    ).toBeUndefined();
    expect(
      buildDataTableListQuery({
        columns,
        filterValues: {active: true},
      }).active
    ).toBe(true);
  });

  it("emits text, date bounds, number range, and choice $in", () => {
    const params = buildDataTableListQuery({
      columns,
      filterValues: {
        age: {$gte: 18, $lte: 65},
        created_gte: "2024-01-01T00:00:00.000Z",
        created_lte: "2024-12-31T23:59:59.999Z",
        name: "alice",
        role: ["staff"],
      },
    });
    expect(params.name).toEqual({$options: "i", $regex: "alice"});
    expect(params.created_gte).toBe("2024-01-01T00:00:00.000Z");
    expect(params.created_lte).toBe("2024-12-31T23:59:59.999Z");
    expect(params.age).toEqual({$gte: 18, $lte: 65});
    expect(params.role).toEqual({$in: ["staff"]});
  });

  it("emits choice $in for a single selected value", () => {
    const params = buildDataTableListQuery({
      columns,
      filterValues: {role: "staff"},
    });
    expect(params.role).toEqual({$in: ["staff"]});
  });

  it("includes toolbar-only filters that are not visible columns", () => {
    const params = buildDataTableListQuery({
      columns: [],
      filters: [{field: "status", kind: "choice"}],
      filterValues: {status: ["open", "closed"]},
    });

    expect(params.status).toEqual({$in: ["open", "closed"]});
  });
});
