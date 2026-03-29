import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Button, Heading, Modal, Spinner, Text} from "@terreno/ui";
import {useRouter} from "expo-router";
import React, {useState} from "react";

import {ChartWidget} from "./ChartWidget";
import type {ChartConfig} from "./types";
import {useDashboardApi} from "./useDashboardApi";

interface WidgetCardProps {
  chartConfig: ChartConfig;
  api: Api<any, any, any, any>;
  widgetId: string;
}

const WidgetCard: React.FC<WidgetCardProps> = ({api, chartConfig, widgetId}) => {
  const {useDashboardQueryQuery} = useDashboardApi(api);
  const {data, error, isLoading} = useDashboardQueryQuery(chartConfig);

  return (
    <Box
      border="default"
      marginBottom={4}
      padding={4}
      rounding="md"
      testID={`dashboard-widget-${widgetId}`}
    >
      <ChartWidget
        chartConfig={chartConfig}
        data={data?.data ?? []}
        error={error}
        isLoading={isLoading}
        testID={`dashboard-widget-chart-${widgetId}`}
      />
    </Box>
  );
};

export interface DashboardViewerProps {
  api: Api<any, any, any, any>;
  dashboardId: string;
  testID?: string;
}

export const DashboardViewer: React.FC<DashboardViewerProps> = ({api, dashboardId, testID}) => {
  const router = useRouter();
  const {useGetDashboardQuery, useDeleteDashboardMutation} = useDashboardApi(api);
  const {data: dashboard, isLoading, error} = useGetDashboardQuery(dashboardId);
  const [deleteDashboard, {isLoading: isDeleting}] = useDeleteDashboardMutation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    await deleteDashboard(dashboardId);
    router.replace("/admin/dashboards");
  };

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" padding={6} testID={testID}>
        <Spinner />
      </Box>
    );
  }

  if (error || !dashboard) {
    return (
      <Box padding={4} testID={testID}>
        <Text color="error">Failed to load dashboard</Text>
      </Box>
    );
  }

  return (
    <Box padding={4} testID={testID ?? "dashboard-viewer"}>
      <Box alignItems="center" direction="row" justifyContent="between" marginBottom={4}>
        <Box flex="grow">
          <Heading size="lg" testID="dashboard-viewer-title">
            {dashboard.title}
          </Heading>
          {dashboard.description ? (
            <Text color="secondaryDark" size="sm">
              {dashboard.description}
            </Text>
          ) : null}
        </Box>
        <Box direction="row" gap={2}>
          <Button
            onClick={() => router.push(`/admin/dashboards/${dashboardId}/edit`)}
            testID="dashboard-viewer-edit-button"
            text="Edit"
            variant="secondary"
          />
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            testID="dashboard-viewer-delete-button"
            text="Delete"
            variant="destructive"
          />
        </Box>
      </Box>

      {dashboard.widgets.length === 0 ? (
        <Box alignItems="center" padding={8} testID="dashboard-viewer-empty">
          <Text color="secondaryDark">This dashboard has no widgets.</Text>
          <Button
            onClick={() => router.push(`/admin/dashboards/${dashboardId}/edit`)}
            text="Add Widgets"
            variant="primary"
          />
        </Box>
      ) : (
        <Box testID="dashboard-viewer-widgets">
          {dashboard.widgets.map((widget) => (
            <WidgetCard
              api={api}
              chartConfig={widget.chart}
              key={widget.widgetId}
              widgetId={widget.widgetId}
            />
          ))}
        </Box>
      )}

      <Modal
        onDismiss={() => setShowDeleteConfirm(false)}
        primaryButtonOnClick={handleDelete}
        primaryButtonText={isDeleting ? "Deleting..." : "Delete"}
        secondaryButtonOnClick={() => setShowDeleteConfirm(false)}
        secondaryButtonText="Cancel"
        title="Delete Dashboard"
        visible={showDeleteConfirm}
      >
        <Text>Are you sure you want to delete "{dashboard.title}"? This cannot be undone.</Text>
      </Modal>
    </Box>
  );
};
