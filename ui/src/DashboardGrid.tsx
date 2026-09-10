import type {FC, ReactNode} from "react";
import {Children} from "react";

import {Box} from "./Box";
import type {DashboardGridProps} from "./Common";
import {useResponsiveBreakpoint} from "./ResponsiveBreakpoint";

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
  const columnCount = Math.max(resolveColumnCount({breakpoint, columns}), 1);
  const widthPercent: `${number}%` = `${100 / columnCount}%`;

  return (
    <Box direction="row" gap={gap} testID={testID} wrap>
      {Children.map(children, (child: ReactNode, index: number) => (
        <Box
          dangerouslySetInlineStyle={{
            __style: {flexBasis: widthPercent, maxWidth: widthPercent},
          }}
          key={`dashboard-cell-${index}`}
        >
          {child}
        </Box>
      ))}
    </Box>
  );
};

export type {DashboardGridProps} from "./Common";
