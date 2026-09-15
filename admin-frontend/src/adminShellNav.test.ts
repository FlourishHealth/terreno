import {describe, it} from "bun:test";
import {assert} from "chai";

import {groupAdminCustomScreens, groupAdminModelsByGroup} from "./adminShellNav";
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
    assert.deepEqual(
      groups.map((g) => g.group),
      ["Alpha", "Zebra", "General"]
    );
    assert.deepEqual(
      groups[0]?.models.map((m) => m.name),
      ["C"]
    );
    assert.deepEqual(
      groups[1]?.models.map((m) => m.name),
      ["A"]
    );
    assert.deepEqual(
      groups[2]?.models.map((m) => m.name),
      ["B"]
    );
  });

  it("returns no groups when models is missing", () => {
    assert.deepEqual(groupAdminModelsByGroup(undefined as unknown as AdminModelConfig[]), []);
  });
});

describe("groupAdminCustomScreens", () => {
  it("keeps ungrouped screens separate from named groups", () => {
    const result = groupAdminCustomScreens([
      {displayName: "AI Requests", name: "ai-requests"},
      {displayName: "Prompts", group: "AI Observability", name: "ai-prompts"},
      {displayName: "Review queue", group: "AI Observability", name: "ai-review"},
    ]);
    assert.deepEqual(
      result.ungrouped.map((screen) => screen.name),
      ["ai-requests"]
    );
    assert.deepEqual(result.grouped, [
      {
        group: "AI Observability",
        screens: [
          {displayName: "Prompts", group: "AI Observability", name: "ai-prompts"},
          {displayName: "Review queue", group: "AI Observability", name: "ai-review"},
        ],
      },
    ]);
  });
});
