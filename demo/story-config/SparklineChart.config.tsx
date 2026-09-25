import {DemoConfiguration} from "@config";
import {
  SparklineChartComparisonStory,
  SparklineChartDemo,
  SparklineChartEmptyStory,
} from "@stories/SparklineChart.stories";
import {SparklineChart} from "@terreno/ui";

export const SparklineChartConfiguration: DemoConfiguration = {
  name: "SparklineChart",
  component: SparklineChart,
  related: ["Scorecard", "LineChart"],
  description:
    "Plot-only line for a KPI. The solid line is the current period and the dotted line is the previous period, scaled to the data range.",
  a11yNotes: ["The sparkline has no axes, legend, or tooltip row."],
  category: "Component",
  status: {
    documentation: "inProgress",
    figma: "notSupported",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  additionalDocumentation: [],
  interfaceName: "SparklineChartProps",
  usage: {
    do: ["Pass current and previous values that share labels."],
    doNot: ["Do not add axis chrome around a sparkline."],
  },
  props: {},
  demo: SparklineChartDemo,
  demoOptions: {size: "md"},
  stories: {
    Comparison: {render: SparklineChartComparisonStory},
    Empty: {render: SparklineChartEmptyStory},
  },
};
