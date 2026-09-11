import type {FC} from "react";
import {useCallback, useState} from "react";
import {Path, Svg} from "react-native-svg";

import {Box} from "./Box";
import type {DonutChartProps, LayoutChangeEvent} from "./Common";
import {ChartFrame} from "./charts/ChartFrame";
import {getDonutSliceAngles, getDonutSliceHitCenter, getDonutSlicePath} from "./charts/paths";
import {getChartPaint} from "./charts/theme";
import type {ChartPoint} from "./charts/types/chartTypes";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {resolveTestID} from "./testing/resolveTestId";

const DEFAULT_SIZE = 220;
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

const getSliceAngles = (
  data: ChartPoint[]
): Array<{end: number; point: ChartPoint; start: number}> => {
  const angles = getDonutSliceAngles(data);
  return data.map((point, index) => {
    const slice = angles[index];
    return {end: slice?.end ?? 0, point, start: slice?.start ?? 0};
  });
};

export const DonutChart: FC<DonutChartProps> = ({
  accessibilityLabel,
  data,
  emptyText = "No data",
  formatValue = String,
  height = DEFAULT_SIZE,
  loading = false,
  testID,
}) => {
  const {theme} = useTheme();
  const paint = getChartPaint(theme);
  const [chartWidth, setChartWidth] = useState(DEFAULT_SIZE);
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

  const size = Math.min(chartWidth, height);
  const center = size / 2;
  const outerRadius = Math.max(size / 2 - 8, 1);
  const innerRadius = outerRadius * 0.55;
  const slices = getSliceAngles(data);
  const tooltipText = activePoint
    ? formatChartTooltip({formatValue, point: activePoint})
    : undefined;
  const summaryLabel = accessibilityLabel ?? "Donut chart";

  return (
    <ChartFrame
      accessibilityLabel={summaryLabel}
      emptyText={emptyText}
      isEmpty={data.length === 0}
      loading={loading}
      testID={testID}
      tooltipText={tooltipText}
    >
      <Box onLayout={handleLayout} width="100%">
        <Box height={size} width={size}>
          <Svg height={size} width={size}>
            {slices.map((slice, index) => (
              <Path
                d={getDonutSlicePath({
                  endAngle: slice.end,
                  innerRadius,
                  outerRadius,
                  startAngle: slice.start,
                })}
                fill={slice.point.color ?? paint.slices[index % paint.slices.length]}
                key={`slice-${slice.point.label}`}
                transform={`translate(${center}, ${center})`}
              />
            ))}
          </Svg>
          {slices.map((slice, index) => {
            const onPress = (): void => {
              handleMarkPress(slice.point);
            };
            const mid = (slice.start + slice.end) / 2;
            const hitRadius = (innerRadius + outerRadius) / 2;
            const hitCenter = getDonutSliceHitCenter({center, hitRadius, midAngle: mid});
            return (
              <Box
                accessibilityHint={`Show value for ${slice.point.label}`}
                accessibilityLabel={`${slice.point.label}: ${formatValue(slice.point.value)}`}
                dangerouslySetInlineStyle={{
                  __style: {
                    height: MARK_HIT_SIZE,
                    left: hitCenter.x - MARK_HIT_SIZE / 2,
                    position: "absolute",
                    top: hitCenter.y - MARK_HIT_SIZE / 2,
                    width: MARK_HIT_SIZE,
                  },
                }}
                key={`mark-${slice.point.label}`}
                onClick={onPress}
                onHoverStart={onPress}
                testID={resolveTestID(testID, `point.${index}`)}
              />
            );
          })}
        </Box>
        <Box direction="column" gap={1} padding={2}>
          {data.map((point, index) => (
            <Box direction="row" gap={2} key={`legend-${point.label}`}>
              <Box
                dangerouslySetInlineStyle={{
                  __style: {
                    backgroundColor: point.color ?? paint.slices[index % paint.slices.length],
                    height: 12,
                    width: 12,
                  },
                }}
                testID={resolveTestID(testID, `swatch.${index}`)}
              />
              <Text size="sm" skipLinking>
                {point.label}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </ChartFrame>
  );
};

export type {DonutChartProps} from "./Common";
export type {ChartPoint} from "./charts/types/chartTypes";
