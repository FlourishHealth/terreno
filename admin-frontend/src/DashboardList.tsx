import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Button, Card, Heading, Spinner, Text} from "@terreno/ui";
import {useRouter} from "expo-router";
import {DateTime} from "luxon";
import React from "react";

import {useDashboardApi} from "./useDashboardApi";

export interface DashboardListProps {
  api: Api<any, any, any, any>;
  testID?: string;
}

export const DashboardList: React.FC<DashboardListProps> = ({api, testID}) => {
  const router = useRouter();
  const {useListDashboardsQuery} = useDashboardApi(api);
  const {data, isLoading, error} = useListDashboardsQuery();

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" padding={6} testID={testID}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={4} testID={testID}>
        <Text color="error">Failed to load dashboards</Text>
      </Box>
    );
  }

  const dashboards = data?.data ?? [];

  return (
    <Box gap={4} padding={4} testID={testID ?? "dashboard-list"}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Heading size="lg">Dashboards</Heading>
        <Button
          onClick={() => router.push("/admin/dashboards/new")}
          testID="dashboard-list-create-button"
          text="Create New"
          variant="primary"
        />
      </Box>

      {dashboards.length === 0 ? (
        <Box alignItems="center" padding={8} testID="dashboard-list-empty">
          <Text color="secondaryDark">No dashboards yet. Create your first dashboard.</Text>
        </Box>
      ) : (
        <Box gap={3}>
          {dashboards.map((dashboard) => (
            <Card
              accessibilityHint="Opens this dashboard"
              accessibilityLabel={dashboard.title}
              key={dashboard._id}
              onClick={() => router.push(`/admin/dashboards/${dashboard._id}`)}
              padding={4}
              testID={`dashboard-list-item-${dashboard._id}`}
            >
              <Box gap={1}>
                <Text bold size="lg">
                  {dashboard.title}
                </Text>
                {dashboard.description ? (
                  <Text color="secondaryDark" size="sm">
                    {dashboard.description}
                  </Text>
                ) : null}
                <Box direction="row" gap={4} marginTop={2}>
                  <Text color="secondaryDark" size="sm">
                    {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? "s" : ""}
                  </Text>
                  <Text color="secondaryDark" size="sm">
                    Updated {DateTime.fromISO(dashboard.updated).toRelative()}
                  </Text>
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};
