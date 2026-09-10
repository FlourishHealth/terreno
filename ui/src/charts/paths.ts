import {arc, area, line} from "d3-shape";

import type {ChartPoint, ChartScales} from "./types";

export const getLinePath = ({
  points,
  scales,
}: {
  points: ChartPoint[];
  scales: ChartScales;
}): string => {
  if (points.length === 0) {
    return "";
  }

  const path = line<ChartPoint>()
    .x((point) => scales.xCenter(point.label))
    .y((point) => scales.y(point.value))(points);

  return path ?? "";
};

export const getAreaPath = ({
  baselineY,
  points,
  scales,
}: {
  baselineY: number;
  points: ChartPoint[];
  scales: ChartScales;
}): string => {
  if (points.length === 0) {
    return "";
  }

  const path = area<ChartPoint>()
    .x((point) => scales.xCenter(point.label))
    .y0(baselineY)
    .y1((point) => scales.y(point.value))(points);

  return path ?? "";
};

export const getDonutSlicePath = ({
  endAngle,
  innerRadius,
  outerRadius,
  startAngle,
}: {
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
}): string => {
  if (startAngle === endAngle || outerRadius <= 0) {
    return "";
  }

  const path = arc()({
    endAngle,
    innerRadius,
    outerRadius,
    startAngle,
  });

  return path ?? "";
};
