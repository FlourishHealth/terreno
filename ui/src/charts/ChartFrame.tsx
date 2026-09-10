import type {FC, ReactNode} from "react";

import {Box} from "../Box";
import {Spinner} from "../Spinner";
import {Text} from "../Text";
import {resolveTestID, toTestProps} from "../testing/resolveTestId";

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
  accessibilityLabel,
  children,
  emptyText,
  isEmpty,
  legendLabel,
  loading = false,
  testID,
  tooltipText,
}) => {
  const showPlot = !loading && !isEmpty;

  return (
    <Box {...toTestProps(testID)}>
      {accessibilityLabel ? (
        <Box display="visuallyHidden">
          <Text skipLinking>{accessibilityLabel}</Text>
        </Box>
      ) : null}
      {loading ? (
        <Box padding={4}>
          <Spinner testID={resolveTestID(testID, "spinner")} />
        </Box>
      ) : null}
      {isEmpty && !loading ? <Text skipLinking>{emptyText}</Text> : null}
      {showPlot ? children : null}
      {showPlot && tooltipText ? (
        <Text size="sm" skipLinking testID={resolveTestID(testID, "tooltip")}>
          {tooltipText}
        </Text>
      ) : null}
      {showPlot && legendLabel ? (
        <Text size="sm" skipLinking testID={resolveTestID(testID, "legend")}>
          {legendLabel}
        </Text>
      ) : null}
    </Box>
  );
};
