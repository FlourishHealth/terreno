import {Box, Text} from "@terreno/ui";
import React from "react";

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

/**
 * Flow-height table for the observability screens. `DataTable` sizes itself to a
 * height-constrained parent and clips fixed-width cells, so inside these scrolling pages its rows
 * overlap and long JSON values are cut mid-line. These rows grow with their content and wrap cell
 * text over a few lines before truncating.
 */
export const ObservabilityTable: React.FC<ObservabilityTableProps> = ({columns, rows, testID}) => {
  return (
    <Box border="default" rounding="md" testID={testID}>
      <Box direction="row" gap={3} paddingX={3} paddingY={2}>
        {columns.map((column) => {
          return (
            <Box flex="grow" key={column.title} minWidth={column.minWidth ?? DEFAULT_MIN_WIDTH}>
              <Text bold size="sm">
                {column.title}
              </Text>
            </Box>
          );
        })}
      </Box>
      {rows.map((row) => {
        return (
          <Box borderTop="default" direction="row" gap={3} key={row.key} paddingX={3} paddingY={2}>
            {row.cells.map((cell, cellIndex) => {
              const column = columns[cellIndex];
              return (
                <Box
                  flex="grow"
                  justifyContent="center"
                  key={column?.title ?? `cell-${cellIndex}`}
                  minWidth={column?.minWidth ?? DEFAULT_MIN_WIDTH}
                >
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
