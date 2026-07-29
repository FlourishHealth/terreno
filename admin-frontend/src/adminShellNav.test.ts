import {describe, expect, it} from "bun:test";

import {groupAdminModelsByGroup} from "./adminShellNav";
import type {AdminModelConfig} from "./types";

const stubModel = (name: string, displayName: string, group?: string): AdminModelConfig =>
  ({
    defaultSort: "-created",
    displayName,
    fields: {},
    group,
    listFields: ["_id"],
    name,
    routePath: `/${name}`,
  }) as unknown as AdminModelConfig;

describe("groupAdminModelsByGroup", () => {
  it("groups by model.group and places General last", () => {
    const groups = groupAdminModelsByGroup([
      stubModel("A", "A", "Zebra"),
      stubModel("B", "B"),
      stubModel("C", "C", "Alpha"),
    ]);
    expect(groups.map((g) => g.group)).toEqual(["Alpha", "Zebra", "General"]);
    expect(groups[0]?.models.map((m) => m.name)).toEqual(["C"]);
    expect(groups[1]?.models.map((m) => m.name)).toEqual(["A"]);
    expect(groups[2]?.models.map((m) => m.name)).toEqual(["B"]);
  });
});
