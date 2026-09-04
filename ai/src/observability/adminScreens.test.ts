import {describe, expect, it} from "bun:test";

import {AI_OBSERVABILITY_GROUP, observabilityAdminScreens} from "./adminScreens";

describe("observabilityAdminScreens", () => {
  it("omits the review queue when the local plugin is off", () => {
    const screens = observabilityAdminScreens({localOn: false});
    expect(screens.map((screen) => screen.name)).toEqual([
      "ai-prompts",
      "ai-traces",
      "ai-evaluators",
      "ai-datasets",
      "ai-experiments",
    ]);
    expect(screens.every((screen) => screen.group === AI_OBSERVABILITY_GROUP)).toBe(true);
  });

  it("includes the review queue when the local plugin is on", () => {
    const screens = observabilityAdminScreens({localOn: true});
    expect(screens.map((screen) => screen.name)).toEqual([
      "ai-prompts",
      "ai-traces",
      "ai-evaluators",
      "ai-datasets",
      "ai-experiments",
      "ai-review",
    ]);
  });
});
