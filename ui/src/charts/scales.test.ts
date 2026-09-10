import {describe, expect, it} from "bun:test";

import {createCartesianScales, getYTickValues} from "./scales";
import type {ChartPoint} from "./types";

const FIXTURE_POINTS: ChartPoint[] = [
  {label: "A", value: 0},
  {label: "B", value: 50},
  {label: "C", value: 100},
];

const PLOT = {height: 100, left: 10, top: 0, width: 90};

describe("createCartesianScales", () => {
  it("maps equal bands and inverted y for a 90x100 plot", () => {
    const scales = createCartesianScales({plot: PLOT, points: FIXTURE_POINTS});

    expect(scales.bandwidth).toBe(30);
    expect(scales.xStart("A")).toBe(10);
    expect(scales.xStart("B")).toBe(40);
    expect(scales.xStart("C")).toBe(70);
    expect(scales.xCenter("A")).toBe(25);
    expect(scales.xCenter("B")).toBe(55);
    expect(scales.xCenter("C")).toBe(85);
    expect(scales.y(0)).toBe(100);
    expect(scales.y(100)).toBe(0);
    expect(scales.y(50)).toBe(50);
  });

  it("returns three ticks from the y domain including zero", () => {
    expect(getYTickValues(FIXTURE_POINTS)).toEqual([0, 50, 100]);
  });

  it("returns no ticks for empty points", () => {
    expect(getYTickValues([])).toEqual([]);
  });

  it("does not throw on empty points", () => {
    const scales = createCartesianScales({plot: PLOT, points: []});

    expect(scales.bandwidth).toBe(0);
    expect(scales.xStart("A")).toBe(PLOT.left);
    expect(scales.xCenter("A")).toBe(PLOT.left);
    expect(scales.y(0)).toBe(PLOT.top + PLOT.height);
  });
});
