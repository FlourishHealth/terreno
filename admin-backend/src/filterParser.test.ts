import {describe, expect, it} from "bun:test";

import type {AdminListFilter} from "./adminUiV2";
import {parseAdminListFilters} from "./filterParser";

const filters: AdminListFilter[] = [
  {field: "admin", kind: "boolean"},
  {choices: [{label: "Staff", value: "staff"}], field: "role", kind: "choice"},
  {field: "name", kind: "text"},
  {field: "ownerId", kind: "ref"},
  {field: "created", kind: "dateRange"},
];

describe("parseAdminListFilters", () => {
  it("parses v2-compatible boolean, choice, text, ref, and dateRange params", () => {
    const {errors, filter, consumedKeys} = parseAdminListFilters(
      {
        admin: "true",
        created_gte: "2024-01-01T00:00:00.000Z",
        created_lte: "2024-12-31T23:59:59.999Z",
        name: "alice",
        ownerId: "507f1f77bcf86cd799439011",
        role: "staff",
      },
      filters
    );

    expect(errors).toEqual({});
    expect(consumedKeys.has("admin")).toBe(true);
    expect(consumedKeys.has("created_gte")).toBe(true);
    expect(filter.admin).toBe(true);
    expect(filter.role).toBe("staff");
    expect(filter.name).toBe("alice");
    expect(filter.ownerId).toBe("507f1f77bcf86cd799439011");
    expect(filter.created).toEqual({
      $gte: new Date("2024-01-01T00:00:00.000Z"),
      $lte: new Date("2024-12-31T23:59:59.999Z"),
    });
  });

  it("rejects invalid shapes and mongo operator keys", () => {
    const {errors} = parseAdminListFilters(
      {
        $where: "1",
        admin: ["true"],
        role: "missing",
      },
      filters
    );

    expect(errors.admin).toBeDefined();
    expect(errors.role).toBeDefined();
    expect(errors.$where).toBeDefined();
  });

  it("drops prototype pollution keys without surfacing them as filter errors", () => {
    const {errors, filter} = parseAdminListFilters(
      {
        __proto__: {polluted: true},
        admin: "true",
      },
      filters
    );

    expect(errors).toEqual({});
    expect(filter.admin).toBe(true);
  });
});
