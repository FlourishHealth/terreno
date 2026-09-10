import type {FC} from "react";
import {useCallback, useState} from "react";
import {Rect, Svg, Line as SvgLine} from "react-native-svg";

import {Box} from "./Box";
import type {BarChartProps, LayoutChangeEvent} from "./Common";
import {ChartFrame} from "./charts/ChartFrame";
import {createCartesianScales, getYTickValues} from "./charts/scales";
import {getChartPaint} from "./charts/theme";
import type {ChartPoint} from "./charts/types";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {resolveTestID} from "./testing/resolveTestId";

const DEFAULT_HEIGHT = 200;
const DEFAULT_WIDTH = 300;
const Y_AXIS_WIDTH = 40;
const PLOT_LEFT = 8;
const PLOT_TOP = 8;
const PLOT_RIGHT = 8;
const PLOT_BOTTOM = 8;
const BAR_FILL = 0.7;

const formatChartTooltip = ({
  formatValue,
  point,
}: {
  formatValue: (value: number) => string;
  point: ChartPoint;
}): string => {
  return `${point.label}: ${formatValue(point.value)}`;
};

export const BarChart: FC<BarChartProps> = ({
  accessibilityLabel,
  data,
  emptyText = "No data",
  formatValue = String,
  height = DEFAULT_HEIGHT,
  legendLabel,
  loading = false,
  testID,
}) => {
  const {theme} = useTheme();
  const paint = getChartPaint(theme);
  const [chartWidth, setChartWidth] = useState(DEFAULT_WIDTH);
  const [activePoint, setActivePoint] = useState<ChartPoint | undefined>(undefined);

  const handleLayout = useCallback((event: LayoutChangeEvent): void => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setChartWidth(nextWidth);
    }
  }, []);

  const handleMarkPress = useCallback((point: ChartPoint): void => {
    setActivePoint(point);
  }, []);

  const plot = {
    height: Math.max(height - PLOT_TOP - PLOT_BOTTOM, 1),
    left: PLOT_LEFT,
    top: PLOT_TOP,
    width: Math.max(chartWidth - PLOT_LEFT - PLOT_RIGHT, 1),
  };
  const scales = createCartesianScales({plot, points: data});
  const yTicks = getYTickValues(data);
  const baselineY = scales.y(0);
  const barWidth = Math.max(scales.bandwidth * BAR_FILL, 1);
  const tooltipText = activePoint
    ? formatChartTooltip({formatValue, point: activePoint})
    : undefined;
  const summaryLabel =
    accessibilityLabel ?? (legendLabel ? `${legendLabel} bar chart` : "Bar chart");

  return (
    <ChartFrame
      accessibilityLabel={summaryLabel}
      emptyText={emptyText}
      isEmpty={data.length === 0}
      legendLabel={legendLabel}
      loading={loading}
      testID={testID}
      tooltipText={tooltipText}
    >
      <Box width="100%">
        <Box direction="row" height={height}>
          <Box height={height} position="relative" width={Y_AXIS_WIDTH}>
            {yTicks.map((tick) => (
              <Box
                dangerouslySetInlineStyle={{
                  __style: {
                    left: 0,
                    position: "absolute",
                    top: scales.y(tick) - 7,
                    width: Y_AXIS_WIDTH,
                  },
                }}
                key={`ytick-${tick}`}
              >
                <Text align="right" color="secondaryDark" size="sm">
                  {formatValue(tick)}
                </Text>
              </Box>
            ))}
          </Box>
          <Box flex="grow" height={height} onLayout={handleLayout} overflow="hidden">
            <Svg height={height} width={chartWidth}>
              {yTicks.map((tick) => {
                const y = scales.y(tick);
                return (
                  <SvgLine
                    key={`grid-${tick}`}
                    stroke={paint.grid}
                    strokeWidth={1}
                    x1={plot.left}
                    x2={plot.left + plot.width}
                    y1={y}
                    y2={y}
                  />
                );
              })}
              {data.map((point) => {
                const barHeight = Math.max(baselineY - scales.y(point.value), 1);
                return (
                  <Rect
                    fill={point.color ?? paint.series}
                    height={barHeight}
                    key={`bar-${point.label}`}
                    width={barWidth}
                    x={scales.xCenter(point.label) - barWidth / 2}
                    y={scales.y(point.value)}
                  />
                );
              })}
            </Svg>
            {data.map((point, index) => {
              const onPress = (): void => {
                handleMarkPress(point);
              };
              const barHeight = Math.max(baselineY - scales.y(point.value), 1);
              return (
                <Box
                  accessibilityHint={`Show value for ${point.label}`}
                  accessibilityLabel={`${point.label}: ${formatValue(point.value)}`}
                  dangerouslySetInlineStyle={{
                    __style: {
                      height: barHeight,
                      left: scales.xCenter(point.label) - barWidth / 2,
                      position: "absolute",
                      top: scales.y(point.value),
                      width: barWidth,
                    },
                  }}
                  key={`mark-${point.label}`}
                  onClick={onPress}
                  onHoverStart={onPress}
                  testID={resolveTestID(testID, `point.${index}`)}
                />
              );
            })}
          </Box>
        </Box>
        <Box
          dangerouslySetInlineStyle={{
            __style: {paddingLeft: Y_AXIS_WIDTH},
          }}
          direction="row"
          justifyContent="between"
        >
          {data.map((point) => (
            <Text color="secondaryDark" key={`xtick-${point.label}`} size="sm">
              {point.label}
            </Text>
          ))}
        </Box>
      </Box>
    </ChartFrame>
  );
};

export type {BarChartProps} from "./Common";
export type {ChartPoint} from "./charts/types";
