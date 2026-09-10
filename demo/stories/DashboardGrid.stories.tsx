import {Box, Card, DashboardGrid, LineChart} from "@terreno/ui";
import type React from "react";

import {StorybookContainer} from "./StorybookContainer";

const SAMPLE_POINTS = [
  {label: "Mon", value: 12},
  {label: "Tue", value: 18},
  {label: "Wed", value: 9},
];

export const DashboardGridDemo = (): React.ReactElement => {
  return (
    <DashboardGrid testID="dashboard-grid-demo">
      <Card>
        <Box padding={3}>
          <LineChart data={SAMPLE_POINTS} height={160} legendLabel="Signups" />
        </Box>
      </Card>
      <Card>
        <Box padding={3}>
          <LineChart data={SAMPLE_POINTS} height={160} legendLabel="Sessions" />
        </Box>
      </Card>
      <Card>
        <Box padding={3}>
          <LineChart data={SAMPLE_POINTS} height={160} legendLabel="Errors" />
        </Box>
      </Card>
    </DashboardGrid>
  );
};

export const DashboardGridDefaultStory = (): React.ReactElement => {
  return (
    <StorybookContainer>
      <DashboardGridDemo />
    </StorybookContainer>
  );
};
