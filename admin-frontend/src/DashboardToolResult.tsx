import {Box, Button, Text} from "@terreno/ui";
import {useRouter} from "expo-router";
import React from "react";

import {ChartWidget} from "./ChartWidget";
import type {ChartConfig} from "./types";

export interface DashboardToolResultData {
  chartConfig?: ChartConfig;
  data?: Record<string, unknown>[];
  dashboardId?: string;
  title?: string;
}

export interface DashboardToolResultProps {
  result: DashboardToolResultData;
  testID?: string;
}

/**
 * Renders GPT tool results for generateChart and createDashboard tools.
 * - If result has chartConfig + data → inline ChartWidget
 * - If result has dashboardId → "View Dashboard →" link
 */
export const DashboardToolResult: React.FC<DashboardToolResultProps> = ({result, testID}) => {
  const router = useRouter();

  if (result.chartConfig && result.data) {
    return (
      <Box border="default" padding={4} rounding="md" testID={testID ?? "dashboard-tool-result"}>
        <ChartWidget
          chartConfig={result.chartConfig}
          data={result.data}
          testID="dashboard-tool-result-chart"
        />
      </Box>
    );
  }

  if (result.dashboardId) {
    return (
      <Box
        alignItems="center"
        border="default"
        direction="row"
        gap={2}
        padding={3}
        rounding="md"
        testID={testID ?? "dashboard-tool-result"}
      >
        <Text>Dashboard "{result.title ?? "Dashboard"}" created.</Text>
        <Button
          onClick={() => router.push(`/admin/dashboards/${result.dashboardId}`)}
          testID="dashboard-tool-result-link"
          text="View Dashboard →"
          variant="secondary"
        />
      </Box>
    );
  }

  return null;
};
