import {BarChart, type BarChartProps, Box} from "@terreno/ui";
import type React from "react";

import {StorybookContainer} from "./StorybookContainer";

const SAMPLE_POINTS = [
  {label: "Mon", value: 12},
  {label: "Tue", value: 18},
  {label: "Wed", value: 9},
  {label: "Thu", value: 22},
  {label: "Fri", value: 15},
];

export const BarChartDemo = (props: Partial<BarChartProps>): React.ReactElement => {
  return (
    <Box width="100%">
      <BarChart data={SAMPLE_POINTS} legendLabel="Signups" testID="bar-chart-demo" {...props} />
    </Box>
  );
};

export const BarChartDefaultStory = (): React.ReactElement => {
  return (
    <StorybookContainer>
      <BarChart data={SAMPLE_POINTS} legendLabel="Signups" testID="bar-chart-default" />
    </StorybookContainer>
  );
};

export const BarChartEmptyStory = (): React.ReactElement => {
  return (
    <StorybookContainer>
      <BarChart data={[]} emptyText="No signups yet" testID="bar-chart-empty" />
    </StorybookContainer>
  );
};
