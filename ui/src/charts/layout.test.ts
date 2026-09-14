import {describe, expect, it} from "bun:test";

import {
  CHART_Y_AXIS_MAX_WIDTH,
  getChartAxisWidth,
  getChartPlot,
  getDonutSize,
  getPlotHeight,
  getXTickStyle,
  getYTickStyle,
} from "./layout";

describe("chart layout", () => {
  it("takes the tick and tooltip rows out of the requested height", () => {
    expect(getPlotHeight({hasLegend: false, height: 200})).toBe(164);
  });

  it("also reserves the legend row when the chart has one", () => {
    expect(getPlotHeight({hasLegend: true, height: 200})).toBe(146);
  });

  it("keeps a drawable plot when the requested height is smaller than the rows", () => {
    expect(getPlotHeight({hasLegend: true, height: 20})).toBe(40);
  });

  it("fits a donut inside the height left by its tooltip and legend rows", () => {
    expect(getDonutSize({chartWidth: 400, height: 220, legendRowCount: 3})).toBe(148);
  });

  it("keeps a donut square when the container is narrower than the height", () => {
    expect(getDonutSize({chartWidth: 90, height: 220, legendRowCount: 1})).toBe(90);
  });

  it("caps the value axis gutter on a wide chart", () => {
    expect(getChartAxisWidth(300)).toBe(CHART_Y_AXIS_MAX_WIDTH);
  });

  it("shrinks the value axis gutter so a narrow chart keeps a plot", () => {
    expect(getChartAxisWidth(100)).toBe(30);
    expect(getChartAxisWidth(0)).toBe(0);
  });

  it("insets the plot inside the measured chart width minus the axis gutter", () => {
    expect(getChartPlot({chartWidth: 300, height: 200})).toEqual({
      height: 184,
      left: 8,
      top: 8,
      width: 244,
    });
  });

  it("keeps a positive plot box when the container is narrower than the insets", () => {
    const plot = getChartPlot({chartWidth: 0, height: 0});

    expect(plot.width).toBe(1);
    expect(plot.height).toBe(1);
  });

  it("centers an x tick slot on its band center", () => {
    expect(getXTickStyle({bandwidth: 60, xCenter: 100})).toEqual({
      left: 70,
      position: "absolute",
      top: 0,
      width: 60,
    });
  });

  it("keeps an x tick slot positive when there are no bands", () => {
    expect(getXTickStyle({bandwidth: 0, xCenter: 10}).width).toBe(1);
  });

  it("centers a y tick label on its value and spans the axis gutter", () => {
    expect(getYTickStyle({axisWidth: 40, y: 50})).toEqual({
      left: 0,
      position: "absolute",
      top: 43,
      width: 40,
    });
  });
});
