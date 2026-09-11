import type {FC} from "react";
import {useCallback, useState} from "react";
import {Circle, Path, Svg, Line as SvgLine} from "react-native-svg";

import {Box} from "./Box";
import type {LayoutChangeEvent, LineChartProps} from "./Common";
import {ChartFrame} from "./charts/ChartFrame";
import {getLinePath} from "./charts/paths";
import {createCartesianScales, getYTickValues} from "./charts/scales";
import {getChartPaint} from "./charts/theme";
import type {ChartPoint} from "./charts/types/chartTypes";
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
const MARK_HIT_SIZE = 24;

const formatChartTooltip = ({
  formatValue,
  point,
}: {
  formatValue: (value: number) => string;
  point: ChartPoint;
}): string => {
  return `${point.label}: ${formatValue(point.value)}`;
};

export const LineChart: FC<LineChartProps> = ({
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
  const linePath = getLinePath({points: data, scales});
  const yTicks = getYTickValues(data);
  const tooltipText = activePoint
    ? formatChartTooltip({formatValue, point: activePoint})
    : undefined;
  const summaryLabel =
    accessibilityLabel ?? (legendLabel ? `${legendLabel} line chart` : "Line chart");

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
              {linePath ? (
                <Path d={linePath} fill="none" stroke={paint.series} strokeWidth={2} />
              ) : null}
              {data.map((point) => (
                <Circle
                  cx={scales.xCenter(point.label)}
                  cy={scales.y(point.value)}
                  fill={paint.series}
                  key={`dot-${point.label}`}
                  r={4}
                />
              ))}
            </Svg>
            {data.map((point, index) => {
              const onPress = (): void => {
                handleMarkPress(point);
              };
              return (
                <Box
                  accessibilityHint={`Show value for ${point.label}`}
                  accessibilityLabel={`${point.label}: ${formatValue(point.value)}`}
                  dangerouslySetInlineStyle={{
                    __style: {
                      height: MARK_HIT_SIZE,
                      left: scales.xCenter(point.label) - MARK_HIT_SIZE / 2,
                      position: "absolute",
                      top: scales.y(point.value) - MARK_HIT_SIZE / 2,
                      width: MARK_HIT_SIZE,
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

export type {LineChartProps} from "./Common";
export type {ChartPoint} from "./charts/types/chartTypes";
