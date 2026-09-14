import {Box, Text} from "@terreno/ui";
import React from "react";
import type {ViewStyle} from "react-native";

export interface ObservabilityTableColumn {
  /** Floor for the column width. Columns share leftover space equally as the row grows. */
  minWidth?: number;
  title: string;
}

export interface ObservabilityTableRow {
  cells: React.ReactNode[];
  key: string;
}

export interface ObservabilityTableProps {
  columns: ObservabilityTableColumn[];
  rows: ObservabilityTableRow[];
  testID: string;
}

const DEFAULT_MIN_WIDTH = 120;
const CELL_LINES = 3;

/** Share column width in a row without `Box flex="grow"` (`display: flex`), which can stretch row height in scroll pages. */
const columnCellStyle = (minWidth: number): ViewStyle => ({
  flexBasis: 0,
  flexGrow: 1,
  flexShrink: 1,
  minWidth,
});

/**
 * Flow-height table for the observability screens. `DataTable` sizes itself to a
 * height-constrained parent and clips fixed-width cells, so inside these scrolling pages its rows
 * overlap and long JSON values are cut mid-line. These rows grow with their content and wrap cell
 * text over a few lines before truncating.
 */
export const ObservabilityTable: React.FC<ObservabilityTableProps> = ({columns, rows, testID}) => {
  return (
    <Box
      alignSelf="start"
      border="default"
      direction="column"
      rounding="md"
      testID={testID}
      width="100%"
    >
      <Box alignItems="start" direction="row" gap={3} paddingX={3} paddingY={2}>
        {columns.map((column) => {
          const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH;
          return (
            <Box key={column.title} style={columnCellStyle(minWidth)}>
              <Text bold size="sm">
                {column.title}
              </Text>
            </Box>
          );
        })}
      </Box>
      {rows.map((row) => {
        return (
          <Box
            alignItems="start"
            borderTop="default"
            direction="row"
            gap={3}
            key={row.key}
            paddingX={3}
            paddingY={2}
          >
            {row.cells.map((cell, cellIndex) => {
              const column = columns[cellIndex];
              const minWidth = column?.minWidth ?? DEFAULT_MIN_WIDTH;
              return (
                <Box key={column?.title ?? `cell-${cellIndex}`} style={columnCellStyle(minWidth)}>
                  {typeof cell === "string" || typeof cell === "number" ? (
                    <Text numberOfLines={CELL_LINES}>{cell}</Text>
                  ) : (
                    cell
                  )}
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};
