import {describe, expect, it} from "bun:test";
import {assert} from "chai";

import {
  CHART_VISUAL_DIFFICULTIES,
  CHART_VISUAL_FIXTURES,
  chartVisualFixtureTestId,
} from "./fixtureCatalog";

describe("chart visual fixture catalog", () => {
  it("keeps unique ids in easy-to-hard order", () => {
    const ids = CHART_VISUAL_FIXTURES.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(12);

    const rank = (difficulty: (typeof CHART_VISUAL_DIFFICULTIES)[number]): number => {
      return CHART_VISUAL_DIFFICULTIES.indexOf(difficulty);
    };
    const ranks = CHART_VISUAL_FIXTURES.map((fixture) => rank(fixture.difficulty));
    for (let index = 1; index < ranks.length; index += 1) {
      expect(ranks[index] ?? 0).toBeGreaterThanOrEqual(ranks[index - 1] ?? 0);
    }
  });

  it("uses a stable test id prefix for Playwright", () => {
    expect(chartVisualFixtureTestId("line-three-points")).toBe("chart-visual-line-three-points");
  });

  it("registers the scorecard comparison fixture as a hard visual", () => {
    const fixture = CHART_VISUAL_FIXTURES.find(
      (entry) => entry.id === "scorecard-sparkline-comparison"
    );

    assert.exists(fixture);
    assert.equal(fixture.difficulty, "hard");
  });
});
