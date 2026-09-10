import {scaleBand, scaleLinear} from "d3-scale";

import type {ChartPlot, ChartPoint, ChartScales} from "./types";

const EMPTY_Y_DOMAIN: [number, number] = [0, 1];

const getYDomain = (points: ChartPoint[]): [number, number] => {
  if (points.length === 0) {
    return EMPTY_Y_DOMAIN;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  if (min === max) {
    return [min, min + 1];
  }

  return [min, max];
};

export const getYTickValues = (points: ChartPoint[]): number[] => {
  if (points.length === 0) {
    return [];
  }

  const [min, max] = getYDomain(points);
  const mid = min + (max - min) / 2;
  return [min, mid, max];
};

export const createCartesianScales = ({
  plot,
  points,
}: {
  plot: ChartPlot;
  points: ChartPoint[];
}): ChartScales => {
  const bottom = plot.top + plot.height;
  const labels = points.map((point) => point.label);
  const xScale = scaleBand<string>()
    .domain(labels)
    .range([plot.left, plot.left + plot.width]);
  const yScale = scaleLinear().domain(getYDomain(points)).range([bottom, plot.top]);
  const bandwidth = labels.length === 0 ? 0 : xScale.bandwidth();

  const xStart = (label: string): number => {
    return xScale(label) ?? plot.left;
  };

  const xCenter = (label: string): number => {
    return xStart(label) + bandwidth / 2;
  };

  const y = (value: number): number => {
    return yScale(value);
  };

  return {bandwidth, xCenter, xStart, y};
};
