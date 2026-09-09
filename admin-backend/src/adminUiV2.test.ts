import {describe, expect, it} from "bun:test";

import {
  buildAdminModelQueryFields,
  defaultBulkPatchAllowlistFrom,
  normalizeAdminHome,
  normalizeSidebarRecentLast,
  SYSTEM_ADMIN_FIELDS,
} from "./adminUiV2";

describe("buildAdminModelQueryFields", () => {
  it("includes _id, list fields, listDisplay, searchFields, and filter fields", () => {
    const fields = buildAdminModelQueryFields({
      filters: [
        {field: "completed", kind: "boolean"},
        {choices: [{label: "L", value: "low"}], field: "priority", kind: "choice"},
        {field: "created", kind: "dateRange"},
      ],
      listDisplay: ["title", "created"],
      listFields: ["title", "ownerId"],
      searchFields: ["tags"],
    });
    expect(fields).toContain("_id");
    expect(fields).toContain("q");
    expect(fields).toContain("title");
    expect(fields).toContain("ownerId");
    expect(fields).toContain("created");
    expect(fields).toContain("tags");
    expect(fields).toContain("completed");
    expect(fields).toContain("priority");
    expect(fields).toContain("created_gte");
    expect(fields).toContain("created_lte");
    expect(new Set(fields).size).toBe(fields.length);
  });
});

describe("normalizeSidebarRecentLast", () => {
  it("returns empty and missing sidebars unchanged", () => {
    expect(normalizeSidebarRecentLast(undefined)).toBeUndefined();
    expect(normalizeSidebarRecentLast([])).toEqual([]);
  });

  it("leaves a sidebar without recentActivity as-is", () => {
    expect(normalizeSidebarRecentLast(["modelsGrid"])).toEqual(["modelsGrid"]);
  });

  it("moves recentActivity to the end", () => {
    expect(normalizeSidebarRecentLast(["recentActivity", "modelsGrid"])).toEqual([
      "modelsGrid",
      "recentActivity",
    ]);
  });
});

describe("normalizeAdminHome", () => {
  it("defaults to modelsGrid when home is omitted", () => {
    expect(normalizeAdminHome()).toEqual({
      slots: {main: ["modelsGrid"]},
      title: "Administration",
    });
  });

  it("uses provided slots and normalizes the sidebar", () => {
    expect(
      normalizeAdminHome({
        slots: {sidebar: ["recentActivity", "nav"]},
        title: "Ops",
      })
    ).toEqual({
      slots: {sidebar: ["nav", "recentActivity"]},
      title: "Ops",
    });
  });

  it("promotes legacy widgets into main and prepends modelsGrid when missing", () => {
    expect(normalizeAdminHome({widgets: ["recentActivity"]})).toEqual({
      slots: {main: ["modelsGrid", "recentActivity"]},
      title: "Administration",
    });
    expect(normalizeAdminHome({widgets: ["modelsGrid", "recentActivity"]})).toEqual({
      slots: {main: ["modelsGrid", "recentActivity"]},
      title: "Administration",
    });
  });
});

describe("defaultBulkPatchAllowlistFrom", () => {
  it("keeps writable schema fields from the list", () => {
    expect(
      defaultBulkPatchAllowlistFrom({
        hiddenFieldSet: new Set(["secret"]),
        listFields: ["_id", "title", "secret", "created", "notes"],
        readonlyFields: ["notes"],
        schemaPaths: new Set(["title", "secret", "notes"]),
      })
    ).toEqual(["title"]);
    expect(SYSTEM_ADMIN_FIELDS.has("_id")).toBe(true);
  });
});
