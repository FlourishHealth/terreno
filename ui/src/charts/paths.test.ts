import {describe, expect, it} from "bun:test";

import {getAreaPath, getDonutSlicePath, getLinePath} from "./paths";
import {createCartesianScales} from "./scales";
import type {ChartPoint} from "./types";

const FIXTURE_POINTS: ChartPoint[] = [
  {label: "A", value: 0},
  {label: "B", value: 50},
  {label: "C", value: 100},
];

const PLOT = {height: 100, left: 10, top: 0, width: 90};

describe("chart paths", () => {
  it("builds a linear line path through the fixture centers", () => {
    const scales = createCartesianScales({plot: PLOT, points: FIXTURE_POINTS});
    const path = getLinePath({points: FIXTURE_POINTS, scales});

    expect(path).toBe("M25,100L55,50L85,0");
  });

  it("builds an area path that includes the plot baseline", () => {
    const scales = createCartesianScales({plot: PLOT, points: FIXTURE_POINTS});
    const path = getAreaPath({baselineY: PLOT.top + PLOT.height, points: FIXTURE_POINTS, scales});

    expect(path).toContain("M25,100");
    expect(path).toContain("L55,50");
    expect(path).toContain("L85,0");
    expect(path).toContain("L85,100");
  });

  it("returns empty strings for empty point lists", () => {
    const scales = createCartesianScales({plot: PLOT, points: []});

    expect(getLinePath({points: [], scales})).toBe("");
    expect(getAreaPath({baselineY: 100, points: [], scales})).toBe("");
    expect(getDonutSlicePath({endAngle: 0, innerRadius: 10, outerRadius: 20, startAngle: 0})).toBe(
      ""
    );
  });

  it("builds a nonempty donut slice for a half-circle", () => {
    const path = getDonutSlicePath({
      endAngle: Math.PI,
      innerRadius: 20,
      outerRadius: 40,
      startAngle: 0,
    });

    expect(path.startsWith("M")).toBe(true);
    expect(path.length).toBeGreaterThan(10);
  });
});
