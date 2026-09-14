import type {FC} from "react";
import {useCallback, useState} from "react";
import {Circle, Path, Svg, Line as SvgLine} from "react-native-svg";

import {Box} from "./Box";
import type {AreaChartProps, LayoutChangeEvent} from "./Common";
import {ChartFrame} from "./charts/ChartFrame";
import {
  CHART_X_AXIS_HEIGHT,
  getChartAxisWidth,
  getChartPlot,
  getPlotHeight,
  getXTickStyle,
  getYTickStyle,
} from "./charts/layout";
import {getAreaPath, getLinePath} from "./charts/paths";
import {createCartesianScales, getYTickValues} from "./charts/scales";
import {getChartPaint} from "./charts/theme";
import type {ChartPoint} from "./charts/types/chartTypes";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {resolveTestID} from "./testing/resolveTestId";

const DEFAULT_HEIGHT = 200;
const DEFAULT_WIDTH = 300;
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

export const AreaChart: FC<AreaChartProps> = ({
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

  const axisWidth = getChartAxisWidth(chartWidth);
  const plotHeight = getPlotHeight({hasLegend: Boolean(legendLabel), height});
  const plot = getChartPlot({chartWidth, height: plotHeight});
  const plotWidth = chartWidth - axisWidth;
  const scales = createCartesianScales({plot, points: data});
  const linePath = getLinePath({points: data, scales});
  const areaPath = getAreaPath({baselineY: scales.y(0), points: data, scales});
  const yTicks = getYTickValues(data);
  const tooltipText = activePoint
    ? formatChartTooltip({formatValue, point: activePoint})
    : undefined;
  const summaryLabel =
    accessibilityLabel ?? (legendLabel ? `${legendLabel} area chart` : "Area chart");

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
      <Box minWidth={0} onLayout={handleLayout} testID={resolveTestID(testID, "plot")} width="100%">
        <Box direction="row" height={plotHeight}>
          <Box height={plotHeight} position="relative" width={axisWidth}>
            {yTicks.map((tick) => (
              <Box
                dangerouslySetInlineStyle={{__style: getYTickStyle({axisWidth, y: scales.y(tick)})}}
                key={`ytick-${tick}`}
              >
                <Text align="right" color="secondaryDark" size="sm" skipLinking truncate>
                  {formatValue(tick)}
                </Text>
              </Box>
            ))}
          </Box>
          <Box flex="grow" height={plotHeight} minWidth={0} overflow="hidden" position="relative">
            <Svg height={plotHeight} width={plotWidth}>
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
              {areaPath ? (
                <Path d={areaPath} fill={paint.seriesFill} fillOpacity={0.25} stroke="none" />
              ) : null}
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
        <Box direction="row">
          <Box width={axisWidth} />
          <Box
            flex="grow"
            height={CHART_X_AXIS_HEIGHT}
            minWidth={0}
            overflow="hidden"
            position="relative"
          >
            {data.map((point, index) => (
              <Box
                dangerouslySetInlineStyle={{
                  __style: getXTickStyle({
                    bandwidth: scales.bandwidth,
                    xCenter: scales.xCenter(point.label),
                  }),
                }}
                key={`xtick-${point.label}`}
                testID={resolveTestID(testID, `xtick.${index}`)}
              >
                <Text align="center" color="secondaryDark" size="sm" skipLinking truncate>
                  {point.label}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </ChartFrame>
  );
};

export type {AreaChartProps} from "./Common";
export type {ChartPoint} from "./charts/types/chartTypes";
