export interface ChartPoint {
  color?: string;
  label: string;
  value: number;
}

export interface ChartPlot {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface ChartScales {
  bandwidth: number;
  xCenter: (label: string) => number;
  xStart: (label: string) => number;
  y: (value: number) => number;
}
