import type {ChartPlot} from "./types/chartTypes";

export const CHART_Y_AXIS_MAX_WIDTH = 40;
export const CHART_X_AXIS_HEIGHT = 18;

const Y_AXIS_WIDTH_RATIO = 0.3;
const PLOT_INSET = 8;
const Y_TICK_HALF_HEIGHT = 7;

export interface ChartTickStyle {
  [key: string]: unknown;
  left: number;
  position: "absolute";
  top: number;
  width: number;
}

/**
 * Value labels take a share of a narrow chart instead of a fixed gutter, so a chart in a small
 * card keeps a usable plot instead of spending most of its width on the axis.
 */
export const getChartAxisWidth = (chartWidth: number): number => {
  if (chartWidth <= 0) {
    return 0;
  }
  return Math.min(CHART_Y_AXIS_MAX_WIDTH, Math.floor(chartWidth * Y_AXIS_WIDTH_RATIO));
};

export const getChartPlot = ({
  chartWidth,
  height,
}: {
  chartWidth: number;
  height: number;
}): ChartPlot => {
  return {
    height: Math.max(height - PLOT_INSET * 2, 1),
    left: PLOT_INSET,
    top: PLOT_INSET,
    width: Math.max(chartWidth - getChartAxisWidth(chartWidth) - PLOT_INSET * 2, 1),
  };
};

/**
 * X tick labels are absolutely positioned on their band center. Laying them out in a flow row
 * instead would let a long label set the chart's min-content width and push the plot past its
 * container.
 */
export const getXTickStyle = ({
  bandwidth,
  xCenter,
}: {
  bandwidth: number;
  xCenter: number;
}): ChartTickStyle => {
  const width = Math.max(bandwidth, 1);
  return {left: xCenter - width / 2, position: "absolute", top: 0, width};
};

export const getYTickStyle = ({axisWidth, y}: {axisWidth: number; y: number}): ChartTickStyle => {
  return {left: 0, position: "absolute", top: y - Y_TICK_HALF_HEIGHT, width: axisWidth};
};
