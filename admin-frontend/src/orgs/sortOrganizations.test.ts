import {describe, expect, it} from "bun:test";
import {sortOrganizations} from "./sortOrganizations";

describe("sortOrganizations", () => {
  it("orders by name then id", () => {
    const sorted = sortOrganizations([
      {_id: "org-z", name: "Zulu"},
      {_id: "org-b", name: "Alpha"},
      {_id: "org-a", name: "Alpha"},
    ]);
    expect(sorted.map((org) => org._id)).toEqual(["org-a", "org-b", "org-z"]);
  });
});
