import type {FC, ReactNode} from "react";

import {Box} from "../Box";
import {Spinner} from "../Spinner";
import {Text} from "../Text";
import {resolveTestID, toTestProps} from "../testing/resolveTestId";
import {CHART_FOOTER_ROW_HEIGHT} from "./layout";

export interface ChartFrameProps {
  accessibilityLabel?: string;
  children: ReactNode;
  emptyText: string;
  isEmpty: boolean;
  legendLabel?: string;
  loading?: boolean;
  testID?: string;
  tooltipText?: string;
}

export const ChartFrame: FC<ChartFrameProps> = ({
  accessibilityLabel: _accessibilityLabel,
  children,
  emptyText,
  isEmpty,
  legendLabel,
  loading = false,
  testID,
  tooltipText,
}) => {
  const showPlot = !loading && !isEmpty;

  // alignSelf stretch keeps the frame full width even when a parent centers its children, so the
  // measured plot width comes from the container instead of the chart's own content.
  return (
    <Box alignSelf="stretch" minWidth={0} width="100%" {...toTestProps(testID)}>
      {loading ? (
        <Box padding={4}>
          <Spinner testID={resolveTestID(testID, "spinner")} />
        </Box>
      ) : null}
      {isEmpty && !loading ? <Text skipLinking>{emptyText}</Text> : null}
      {showPlot ? children : null}
      {showPlot ? (
        <Box height={CHART_FOOTER_ROW_HEIGHT} minWidth={0} overflow="hidden">
          {tooltipText ? (
            <Text size="sm" skipLinking testID={resolveTestID(testID, "tooltip")} truncate>
              {tooltipText}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {showPlot && legendLabel ? (
        <Box height={CHART_FOOTER_ROW_HEIGHT} minWidth={0} overflow="hidden">
          <Text size="sm" skipLinking testID={resolveTestID(testID, "legend")} truncate>
            {legendLabel}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
};
