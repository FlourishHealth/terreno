import {Box, Spinner, Text, useTheme} from "@terreno/ui";
import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {ChartConfig, ChartType} from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartWidgetProps {
  chartConfig: ChartConfig;
  data: Record<string, unknown>[];
  isLoading?: boolean;
  error?: unknown;
  testID?: string;
}

// ─── Color palette ────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#06b6d4",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getYKey = (index: number, total: number): string => (total === 1 ? "y" : `y${index}`);

const getYLabel = (chartConfig: ChartConfig, index: number): string => {
  const yAxes = Array.isArray(chartConfig.y) ? chartConfig.y : [chartConfig.y];
  const axis = yAxes[index];
  if (!axis) {
    return `y${index}`;
  }
  return axis.label ?? axis.field;
};

const getXLabel = (chartConfig: ChartConfig): string => chartConfig.x.label ?? chartConfig.x.field;

// ─── Chart renderers ──────────────────────────────────────────────────────────

const renderBarChart = (
  chartConfig: ChartConfig,
  data: Record<string, unknown>[],
  type: ChartType
) => {
  const yAxes = Array.isArray(chartConfig.y) ? chartConfig.y : [chartConfig.y];
  const isHorizontal = type === "bar-horizontal";
  const isStacked = type === "bar-stacked";
  const isGrouped = type === "bar-grouped";

  return (
    <ResponsiveContainer height={300} width="100%">
      <BarChart data={data} layout={isHorizontal ? "vertical" : "horizontal"}>
        <CartesianGrid strokeDasharray="3 3" />
        {isHorizontal ? (
          <>
            <XAxis type="number" />
            <YAxis dataKey="x" type="category" width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey="x" />
            <YAxis />
          </>
        )}
        <Tooltip />
        {yAxes.length > 1 && <Legend />}
        {yAxes.map((axis, i) => (
          <Bar
            dataKey={getYKey(i, yAxes.length)}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            key={axis.field}
            name={getYLabel(chartConfig, i)}
            stackId={isStacked ? "stack" : isGrouped ? undefined : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

const renderLineChart = (
  chartConfig: ChartConfig,
  data: Record<string, unknown>[],
  type: ChartType
) => {
  const yAxes = Array.isArray(chartConfig.y) ? chartConfig.y : [chartConfig.y];
  const isMulti = type === "line-multi";

  if (isMulti && chartConfig.color) {
    // Group data by color dimension
    const colorKey = "color";
    const colorValues = [...new Set(data.map((d) => String(d[colorKey])))];
    const pivot: Record<string, Record<string, unknown>> = {};
    for (const row of data) {
      const xKey = String(row.x);
      if (!pivot[xKey]) {
        pivot[xKey] = {x: row.x};
      }
      const colorVal = String(row[colorKey]);
      pivot[xKey][colorVal] = row.y;
    }
    const pivotedData = Object.values(pivot);

    return (
      <ResponsiveContainer height={300} width="100%">
        <LineChart data={pivotedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip />
          <Legend />
          {colorValues.map((colorVal, i) => (
            <Line
              dataKey={colorVal}
              dot={false}
              key={colorVal}
              name={colorVal}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer height={300} width="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" />
        <YAxis />
        <Tooltip />
        {yAxes.length > 1 && <Legend />}
        {yAxes.map((axis, i) => (
          <Line
            dataKey={getYKey(i, yAxes.length)}
            dot={false}
            key={axis.field}
            name={getYLabel(chartConfig, i)}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            type="monotone"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

const renderAreaChart = (
  chartConfig: ChartConfig,
  data: Record<string, unknown>[],
  type: ChartType
) => {
  const yAxes = Array.isArray(chartConfig.y) ? chartConfig.y : [chartConfig.y];
  const isStacked = type === "area-stacked";

  return (
    <ResponsiveContainer height={300} width="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" />
        <YAxis />
        <Tooltip />
        {yAxes.length > 1 && <Legend />}
        {yAxes.map((axis, i) => (
          <Area
            dataKey={getYKey(i, yAxes.length)}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            key={axis.field}
            name={getYLabel(chartConfig, i)}
            stackId={isStacked ? "stack" : undefined}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            type="monotone"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

const renderPieChart = (
  data: Record<string, unknown>[],
  type: ChartType,
  _chartConfig: ChartConfig
) => {
  const isDonut = type === "donut";
  const chartData = data.map((d) => ({
    name: String(d.color ?? d.x),
    value: Number(d.y),
  }));

  return (
    <ResponsiveContainer height={300} width="100%">
      <PieChart>
        <Pie
          cx="50%"
          cy="50%"
          data={chartData}
          dataKey="value"
          innerRadius={isDonut ? "40%" : undefined}
          label={({name, percent}: {name: string; percent: number}) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          outerRadius="80%"
        >
          {chartData.map((_entry, i) => (
            <Cell fill={CHART_COLORS[i % CHART_COLORS.length]} key={`cell-${i}`} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

const renderScatterChart = (data: Record<string, unknown>[], chartConfig: ChartConfig) => {
  const colorGroups = chartConfig.color
    ? [...new Set(data.map((d) => String(d.color ?? "default")))]
    : ["default"];

  return (
    <ResponsiveContainer height={300} width="100%">
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          label={{offset: -5, position: "insideBottom", value: getXLabel(chartConfig)}}
          type="number"
        />
        <YAxis
          dataKey="y"
          label={{angle: -90, position: "insideLeft", value: getYLabel(chartConfig, 0)}}
          type="number"
        />
        <Tooltip cursor={{strokeDasharray: "3 3"}} />
        {colorGroups.length > 1 && <Legend />}
        {colorGroups.map((group, i) => {
          const groupData = chartConfig.color
            ? data.filter((d) => String(d.color ?? "default") === group)
            : data;
          return (
            <Scatter
              data={groupData as any[]}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              key={group}
              name={group}
            />
          );
        })}
      </ScatterChart>
    </ResponsiveContainer>
  );
};

const renderBubbleChart = (data: Record<string, unknown>[], _chartConfig: ChartConfig) => {
  return (
    <ResponsiveContainer height={300} width="100%">
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" type="number" />
        <YAxis dataKey="y" type="number" />
        <Tooltip cursor={{strokeDasharray: "3 3"}} />
        <Scatter
          data={data.map((d) => ({...d, z: d.size ?? d.y}))}
          fill={CHART_COLORS[0]}
          name="Data"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

const renderHeatmap = (data: Record<string, unknown>[], chartConfig: ChartConfig) => {
  // Recharts doesn't have a native heatmap — render as stacked bar approximation
  return (
    <ResponsiveContainer height={300} width="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="y" fill={CHART_COLORS[0]} name={getYLabel(chartConfig, 0)} stackId="heat" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const renderComboChart = (data: Record<string, unknown>[], chartConfig: ChartConfig) => {
  const yAxes = Array.isArray(chartConfig.y) ? chartConfig.y : [chartConfig.y];

  return (
    <ResponsiveContainer height={300} width="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" />
        <YAxis />
        <Tooltip />
        <Legend />
        {yAxes.map((axis, i) =>
          i === 0 ? (
            <Bar
              dataKey={getYKey(i, yAxes.length)}
              fill={CHART_COLORS[0]}
              key={axis.field}
              name={getYLabel(chartConfig, i)}
            />
          ) : (
            <Line
              dataKey={getYKey(i, yAxes.length)}
              dot={false}
              key={axis.field}
              name={getYLabel(chartConfig, i)}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              type="monotone"
            />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ChartWidgetInner = ({chartConfig, data, error, isLoading, testID}: ChartWidgetProps) => {
  const {theme} = useTheme();

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" padding={4} testID={testID}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        alignItems="center"
        border="error"
        justifyContent="center"
        padding={4}
        rounding="md"
        testID={testID}
      >
        <Text color="error">Failed to load chart data</Text>
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box alignItems="center" justifyContent="center" padding={4} testID={testID}>
        <Text color="secondaryDark" testID={testID ? `${testID}-empty` : undefined}>
          No data available
        </Text>
      </Box>
    );
  }

  const {type} = chartConfig;

  let chart: React.ReactNode;

  if (
    type === "bar" ||
    type === "bar-horizontal" ||
    type === "bar-stacked" ||
    type === "bar-grouped"
  ) {
    chart = renderBarChart(chartConfig, data, type);
  } else if (type === "line" || type === "line-multi") {
    chart = renderLineChart(chartConfig, data, type);
  } else if (type === "area" || type === "area-stacked") {
    chart = renderAreaChart(chartConfig, data, type);
  } else if (type === "pie" || type === "donut") {
    chart = renderPieChart(data, type, chartConfig);
  } else if (type === "scatter") {
    chart = renderScatterChart(data, chartConfig);
  } else if (type === "bubble") {
    chart = renderBubbleChart(data, chartConfig);
  } else if (type === "heatmap") {
    chart = renderHeatmap(data, chartConfig);
  } else if (type === "combo") {
    chart = renderComboChart(data, chartConfig);
  } else {
    chart = (
      <Box padding={4} testID={testID}>
        <Text color="secondaryDark">Unsupported chart type: {type}</Text>
      </Box>
    );
  }

  return (
    <Box testID={testID}>
      <Box marginBottom={2}>
        <Text bold size="md">
          {chartConfig.title}
        </Text>
      </Box>
      {chart}
    </Box>
  );
};

export const ChartWidget = React.memo(ChartWidgetInner);
