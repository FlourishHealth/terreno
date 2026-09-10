import type {FC, ReactNode} from "react";
import {Children, useCallback, useState} from "react";

import {Box} from "./Box";
import type {DashboardGridProps, LayoutChangeEvent} from "./Common";
import {getSpacing} from "./Common";
import {getDashboardCellBoxStyle} from "./dashboardGridLayout";
import {useResponsiveBreakpoint} from "./ResponsiveBreakpoint";
import {resolveTestID} from "./testing/resolveTestId";

const DEFAULT_COLUMNS = {lg: 3, md: 2, sm: 1};

const resolveColumnCount = ({
  breakpoint,
  columns,
}: {
  breakpoint: "xs" | "sm" | "md" | "lg" | "xl";
  columns: {lg: number; md: number; sm: number};
}): number => {
  if (breakpoint === "lg" || breakpoint === "xl") {
    return columns.lg;
  }
  if (breakpoint === "md") {
    return columns.md;
  }
  return columns.sm;
};

export const DashboardGrid: FC<DashboardGridProps> = ({
  children,
  columns = DEFAULT_COLUMNS,
  gap = 4,
  testID,
}) => {
  const breakpoint = useResponsiveBreakpoint({enabled: true});
  const [rowWidth, setRowWidth] = useState(0);
  const columnCount = Math.max(resolveColumnCount({breakpoint, columns}), 1);
  const cellStyle = getDashboardCellBoxStyle({
    columnCount,
    gapPx: getSpacing(gap),
    rowWidth,
  });

  const handleLayout = useCallback((event: LayoutChangeEvent): void => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setRowWidth(nextWidth);
    }
  }, []);

  return (
    <Box direction="row" gap={gap} onLayout={handleLayout} testID={testID} wrap>
      {Children.map(children, (child: ReactNode, index: number) => (
        <Box
          dangerouslySetInlineStyle={{
            __style: cellStyle,
          }}
          key={`dashboard-cell-${index}`}
          testID={resolveTestID(testID, `cell.${index}`)}
        >
          {child}
        </Box>
      ))}
    </Box>
  );
};

export type {DashboardGridProps} from "./Common";
