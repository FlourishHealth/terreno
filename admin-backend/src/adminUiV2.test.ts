import {describe, expect, it} from "bun:test";

import {buildAdminModelQueryFields} from "./adminUiV2";

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
