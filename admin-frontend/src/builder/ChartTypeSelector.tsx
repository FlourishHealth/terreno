import {Box, SelectField} from "@terreno/ui";
import React from "react";

import type {ChartType} from "../types";

const CHART_TYPE_OPTIONS: {label: string; value: ChartType}[] = [
  {label: "Bar", value: "bar"},
  {label: "Bar (Horizontal)", value: "bar-horizontal"},
  {label: "Bar (Stacked)", value: "bar-stacked"},
  {label: "Bar (Grouped)", value: "bar-grouped"},
  {label: "Line", value: "line"},
  {label: "Line (Multi-series)", value: "line-multi"},
  {label: "Area", value: "area"},
  {label: "Area (Stacked)", value: "area-stacked"},
  {label: "Pie", value: "pie"},
  {label: "Donut", value: "donut"},
  {label: "Scatter", value: "scatter"},
  {label: "Bubble", value: "bubble"},
  {label: "Heatmap", value: "heatmap"},
  {label: "Combo (Bar + Line)", value: "combo"},
];

export interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
  testID?: string;
}

export const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({onChange, testID, value}) => {
  return (
    <Box testID={testID ?? "chart-type-selector"}>
      <SelectField
        onChange={(v) => onChange(v as ChartType)}
        options={CHART_TYPE_OPTIONS}
        requireValue
        title="Chart Type"
        value={value}
      />
    </Box>
  );
};
