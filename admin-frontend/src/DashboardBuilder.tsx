import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Button, Card, Heading, Spinner, Text, TextField} from "@terreno/ui";
import {useRouter} from "expo-router";
import React, {useEffect, useState} from "react";
import {AxisConfigForm} from "./builder/AxisConfigForm";
import {ChartTypeSelector} from "./builder/ChartTypeSelector";
import {DataSourcePicker} from "./builder/DataSourcePicker";
import {FieldList} from "./builder/FieldList";
import {FilterBuilder} from "./builder/FilterBuilder";
import {SortConfig} from "./builder/SortConfig";
import {ChartWidget} from "./ChartWidget";
import type {ChartConfig} from "./types";
import type {DashboardWidget} from "./useDashboardApi";
import {useDashboardApi} from "./useDashboardApi";

// ─── Widget editor state ──────────────────────────────────────────────────────

const defaultChartConfig = (): ChartConfig => ({
  dataSource: "",
  limit: 1000,
  title: "New Chart",
  type: "bar",
  x: {field: ""},
  y: {aggregation: "count", field: ""},
});

// ─── Widget preview card ──────────────────────────────────────────────────────

interface WidgetPreviewProps {
  chartConfig: ChartConfig;
  api: Api<any, any, any, any>;
  isEnabled: boolean;
}

const WidgetPreview: React.FC<WidgetPreviewProps> = ({api, chartConfig, isEnabled}) => {
  const {useDashboardQueryQuery} = useDashboardApi(api);
  const {data, error, isLoading} = useDashboardQueryQuery(chartConfig, {skip: !isEnabled});

  return (
    <ChartWidget
      chartConfig={chartConfig}
      data={data?.data ?? []}
      error={error}
      isLoading={isLoading}
      testID="builder-preview-chart"
    />
  );
};

// ─── Widget editor ────────────────────────────────────────────────────────────

interface WidgetEditorProps {
  chart: ChartConfig;
  onChange: (chart: ChartConfig) => void;
  api: Api<any, any, any, any>;
  supportsWindowFields: boolean;
}

const WidgetEditor: React.FC<WidgetEditorProps> = ({
  api,
  chart,
  onChange,
  supportsWindowFields,
}) => {
  const {useSourcesQuery} = useDashboardApi(api);
  const {data: sourcesData, isLoading: sourcesLoading} = useSourcesQuery();

  const sources = sourcesData?.data ?? [];
  const selectedSource = sources.find((s) => s.name === chart.dataSource);
  const fields = selectedSource?.fields ?? {};

  const yAxes = Array.isArray(chart.y) ? chart.y : [chart.y];

  // Debounced preview — the parent handles debouncing via a ref
  const isPreviewEnabled =
    !!chart.dataSource &&
    !!chart.x.field &&
    yAxes.some((a) => !!a.field || a.aggregation === "count");

  return (
    <Box gap={4}>
      <TextField
        onChange={(title) => onChange({...chart, title})}
        testID="widget-editor-title"
        title="Chart Title"
        value={chart.title}
      />

      <DataSourcePicker
        isLoading={sourcesLoading}
        onChange={(dataSource) =>
          onChange({...chart, dataSource, x: {field: ""}, y: {aggregation: "count", field: ""}})
        }
        sources={sources}
        testID="widget-editor-source"
        value={chart.dataSource}
      />

      {selectedSource && (
        <>
          <Box>
            <Box marginBottom={2}>
              <Text bold size="sm">
                Available Fields
              </Text>
            </Box>
            <FieldList fields={fields} testID="widget-editor-fields" />
          </Box>

          <ChartTypeSelector
            onChange={(type) => onChange({...chart, type})}
            testID="widget-editor-chart-type"
            value={chart.type}
          />

          <AxisConfigForm
            fields={fields}
            label="X"
            onChange={(x) => onChange({...chart, x})}
            showAggregation={false}
            supportsWindowFields={supportsWindowFields}
            testID="widget-editor-x-axis"
            value={chart.x}
          />

          <AxisConfigForm
            fields={fields}
            label="Y"
            onChange={(y) => onChange({...chart, y})}
            showAggregation
            supportsWindowFields={supportsWindowFields}
            testID="widget-editor-y-axis"
            value={yAxes[0]}
          />

          <FilterBuilder
            fields={fields}
            filters={chart.filters ?? []}
            onChange={(filters) => onChange({...chart, filters})}
            testID="widget-editor-filters"
          />

          <SortConfig
            fields={fields}
            onChange={(sort) => onChange({...chart, sort})}
            testID="widget-editor-sort"
            value={chart.sort}
          />

          <Box border="default" padding={3} rounding="md">
            <Box marginBottom={2}>
              <Text bold size="sm">
                Live Preview
              </Text>
            </Box>
            <WidgetPreview api={api} chartConfig={chart} isEnabled={isPreviewEnabled} />
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Main builder ─────────────────────────────────────────────────────────────

export interface DashboardBuilderProps {
  api: Api<any, any, any, any>;
  dashboardId?: string;
  testID?: string;
}

export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({api, dashboardId, testID}) => {
  const router = useRouter();
  const {
    useGetDashboardQuery,
    useCreateDashboardMutation,
    useUpdateDashboardMutation,
    useSourcesQuery,
  } = useDashboardApi(api);

  const isEditing = !!dashboardId;
  const {data: existingDashboard, isLoading: dashboardLoading} = useGetDashboardQuery(
    dashboardId ?? "",
    {skip: !dashboardId}
  );
  const {data: sourcesData} = useSourcesQuery();
  const supportsWindowFields = sourcesData?.supportsWindowFields ?? false;

  const [createDashboard, {isLoading: isCreating}] = useCreateDashboardMutation();
  const [updateDashboard, {isLoading: isUpdating}] = useUpdateDashboardMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [activeWidgetIndex, setActiveWidgetIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize form from existing dashboard
  useEffect(() => {
    if (existingDashboard) {
      setTitle(existingDashboard.title);
      setDescription(existingDashboard.description ?? "");
      setWidgets(existingDashboard.widgets);
    }
  }, [existingDashboard]);

  const addWidget = () => {
    const newWidget: DashboardWidget = {
      chart: defaultChartConfig(),
      widgetId: `widget-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    setWidgets((prev) => [...prev, newWidget]);
    setActiveWidgetIndex(widgets.length);
  };

  const removeWidget = (index: number) => {
    setWidgets((prev) => prev.filter((_, i) => i !== index));
    setActiveWidgetIndex(null);
  };

  const updateWidget = (index: number, chart: ChartConfig) => {
    setWidgets((prev) => prev.map((w, i) => (i === index ? {...w, chart} : w)));
  };

  const moveWidget = (index: number, direction: "up" | "down") => {
    const newWidgets = [...widgets];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newWidgets.length) {
      return;
    }
    [newWidgets[index], newWidgets[targetIndex]] = [newWidgets[targetIndex], newWidgets[index]];
    setWidgets(newWidgets);
    setActiveWidgetIndex(targetIndex);
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!title.trim()) {
      setSaveError("Title is required");
      return;
    }

    try {
      const payload = {
        description: description || undefined,
        title: title.trim(),
        widgets: widgets.map((w) => ({chart: w.chart, widgetId: w.widgetId})),
      };

      if (isEditing && dashboardId) {
        await updateDashboard({...payload, id: dashboardId});
        router.replace(`/admin/dashboards/${dashboardId}`);
      } else {
        const result = (await createDashboard(payload)) as any;
        const id = result?.data?._id;
        if (id) {
          router.replace(`/admin/dashboards/${id}`);
        } else {
          router.replace("/admin/dashboards");
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save dashboard");
    }
  };

  if (isEditing && dashboardLoading) {
    return (
      <Box alignItems="center" justifyContent="center" padding={6} testID={testID}>
        <Spinner />
      </Box>
    );
  }

  const activeWidget = activeWidgetIndex !== null ? widgets[activeWidgetIndex] : null;

  return (
    <Box padding={4} testID={testID ?? "dashboard-builder"}>
      <Box alignItems="center" direction="row" justifyContent="between" marginBottom={4}>
        <Heading size="lg">{isEditing ? "Edit Dashboard" : "New Dashboard"}</Heading>
        <Box direction="row" gap={2}>
          <Button
            onClick={() => router.back()}
            testID="builder-cancel-button"
            text="Cancel"
            variant="secondary"
          />
          <Button
            loading={isCreating || isUpdating}
            onClick={handleSave}
            testID="builder-save-button"
            text={isEditing ? "Save Changes" : "Create Dashboard"}
            variant="primary"
          />
        </Box>
      </Box>

      {saveError && (
        <Box border="error" marginBottom={4} padding={3} rounding="md">
          <Text color="error">{saveError}</Text>
        </Box>
      )}

      <Box direction="row" gap={4}>
        {/* Left panel: dashboard metadata + widget list */}
        <Box style={{flex: 1}}>
          <Card marginBottom={4} padding={4}>
            <Box gap={3}>
              <TextField
                onChange={setTitle}
                testID="builder-title-input"
                title="Dashboard Title"
                value={title}
              />
              <TextField
                multiline
                onChange={setDescription}
                placeholder="Optional description"
                testID="builder-description-input"
                title="Description"
                value={description}
              />
            </Box>
          </Card>

          <Box alignItems="center" direction="row" justifyContent="between" marginBottom={2}>
            <Text bold>Widgets</Text>
            <Button
              iconName="plus"
              onClick={addWidget}
              testID="builder-add-widget-button"
              text="Add Widget"
              variant="secondary"
            />
          </Box>

          {widgets.length === 0 ? (
            <Text color="secondaryDark" size="sm">
              No widgets added yet.
            </Text>
          ) : (
            widgets.map((widget, index) => (
              <Card
                accessibilityHint="Edit this widget"
                accessibilityLabel={widget.chart.title || `Widget ${index + 1}`}
                key={widget.widgetId}
                marginBottom={2}
                onClick={() => setActiveWidgetIndex(index === activeWidgetIndex ? null : index)}
                padding={3}
                testID={`builder-widget-card-${index}`}
              >
                <Box alignItems="center" direction="row" justifyContent="between">
                  <Text bold size="sm">
                    {widget.chart.title || `Widget ${index + 1}`}
                  </Text>
                  <Box direction="row" gap={1}>
                    <Button
                      disabled={index === 0}
                      iconName="arrow-up"
                      onClick={() => moveWidget(index, "up")}
                      testID={`builder-widget-up-${index}`}
                      text=""
                      variant="muted"
                    />
                    <Button
                      disabled={index === widgets.length - 1}
                      iconName="arrow-down"
                      onClick={() => moveWidget(index, "down")}
                      testID={`builder-widget-down-${index}`}
                      text=""
                      variant="muted"
                    />
                    <Button
                      iconName="trash"
                      onClick={() => removeWidget(index)}
                      testID={`builder-widget-delete-${index}`}
                      text=""
                      variant="destructive"
                    />
                  </Box>
                </Box>
              </Card>
            ))
          )}
        </Box>

        {/* Right panel: widget editor */}
        {activeWidget !== null && activeWidgetIndex !== null && (
          <Box style={{flex: 2}}>
            <Card padding={4}>
              <Box marginBottom={4}>
                <Text bold size="lg">
                  Edit Widget
                </Text>
              </Box>
              <WidgetEditor
                api={api}
                chart={activeWidget.chart}
                onChange={(chart) => updateWidget(activeWidgetIndex, chart)}
                supportsWindowFields={supportsWindowFields}
              />
            </Card>
          </Box>
        )}
      </Box>
    </Box>
  );
};
