import {FontAwesome6} from "@expo/vector-icons";
import type React from "react";
import {type FC, useCallback, useMemo, useRef, useState} from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";

import {Box} from "./Box";
import type {
  ColumnSortInterface,
  DataTableCellData,
  DataTableCellProps,
  DataTableColumn,
  DataTableCustomComponentMap,
  DataTableProps,
  SurfaceColor,
} from "./Common";
import {Icon} from "./Icon";
import {InfoModalIcon} from "./InfoModalIcon";
import {Modal} from "./Modal";
import {Pagination} from "./Pagination";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {TableTitle} from "./table/TableTitle";

// TODO: Add permanent horizontal scroll bar so users with only a mouse can scroll left/right
// easily.

const TextCell: FC<{
  cellData: {value: string; textSize?: "sm" | "md" | "lg"};
  column: DataTableColumn;
}> = ({cellData}) => {
  return (
    <Box flex="grow" justifyContent="center" paddingX={2}>
      <Text size={cellData.textSize || "md"}>{cellData.value}</Text>
    </Box>
  );
};

const CheckedCell: FC<{cellData: {value: boolean}; column: DataTableColumn}> = ({cellData}) => {
  return (
    <Box flex="grow" justifyContent="center" width="100%">
      <Icon
        color={cellData.value ? "success" : "secondaryDark"}
        iconName={cellData.value ? "check" : "x"}
      />
    </Box>
  );
};

const DataTableCell: FC<DataTableCellProps> = ({
  value,
  columnDef,
  colIndex,
  isPinnedHorizontal,
  pinnedColumns,
  columnWidths,
  customColumnComponentMap,
  backgroundColor,
  height,
  textSize = "md",
}) => {
  const {theme} = useTheme();
  const isLastPinnedColumn = isPinnedHorizontal && colIndex === pinnedColumns - 1;

  // Default to TextCell
  let Component: React.ComponentType<{
    column: DataTableColumn;
    cellData: {value: any; highlight?: SurfaceColor};
  }> = TextCell;
  if (customColumnComponentMap?.[columnDef.columnType]) {
    Component = customColumnComponentMap[columnDef.columnType];
  } else if (columnDef.columnType === "boolean") {
    Component = CheckedCell;
  }

  return (
    <View
      style={{
        backgroundColor,
        borderBottomColor: theme.border.default,
        borderBottomWidth: 1,
        height,
        justifyContent: "center",
        overflow: "hidden",
        padding: 16,
        position: "relative",
        width: columnDef.width,
        zIndex: 1,
        // For pinned columns: use absolute positioning to stay fixed while scrolling horizontally
        ...(isPinnedHorizontal && {
          // Position each pinned column by summing widths of all previous columns
          left: columnWidths.slice(0, colIndex).reduce((sum, width) => sum + width, 0),
          position: "absolute",
          // Higher z-index keeps pinned columns above scrollable ones, decreasing by column index
          zIndex: 10 - colIndex,
        }),
        // Visual separator after last pinned column
        ...(isLastPinnedColumn && {
          borderRightColor: theme.border.default,
          borderRightWidth: 3,
        }),
      }}
    >
      <Component cellData={{...value, textSize}} column={columnDef} />
    </View>
  );
};

interface DataTableRowProps {
  rowData: DataTableCellData[];
  rowIndex: number;
  columns: DataTableColumn[];
  pinnedColumns: number;
  columnWidths: number[];
  alternateRowBackground: boolean;
  customColumnComponentMap?: DataTableCustomComponentMap;
  rowHeight: number;
}

const DataTableRow: FC<DataTableRowProps> = ({
  rowData,
  rowIndex,
  columns,
  pinnedColumns,
  columnWidths,
  alternateRowBackground,
  customColumnComponentMap,
  rowHeight,
}) => {
  const {theme} = useTheme();
  const backgroundColor =
    alternateRowBackground && rowIndex % 2 === 1 ? theme.surface.neutralLight : theme.surface.base;

  return (
    <View
      style={{
        borderBottomColor: theme.border.default,
        borderBottomWidth: 1,
        flexDirection: "row",
        height: rowHeight,
      }}
    >
      {rowData.map((cell, colIndex) => (
        <DataTableCell
          backgroundColor={
            cell.highlight ? theme.surface[cell.highlight as SurfaceColor] : backgroundColor
          }
          colIndex={colIndex}
          columnDef={columns[colIndex]}
          columnWidths={columnWidths}
          customColumnComponentMap={customColumnComponentMap}
          height={rowHeight}
          isPinnedHorizontal={colIndex < pinnedColumns}
          key={colIndex}
          pinnedColumns={pinnedColumns}
          textSize={cell.textSize}
          value={cell}
        />
      ))}
    </View>
  );
};

interface MoreButtonCellProps {
  rowIndex: number;
  alternateRowBackground: boolean;
  onClick: (rowIndex: number) => void;
  column: DataTableColumn;
  rowHeight: number;
}

const MoreButtonCell: FC<MoreButtonCellProps> = ({
  rowIndex,
  alternateRowBackground,
  onClick,
  rowHeight,
}) => {
  const {theme} = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor:
          alternateRowBackground && rowIndex % 2 === 1
            ? theme.surface.neutralLight
            : theme.surface.base,
        borderBottomColor: theme.border.default,
        borderBottomWidth: 1,
        height: rowHeight ?? 54,
        justifyContent: "center",
        width: 48,
      }}
    >
      <Pressable
        accessibilityHint="View details"
        accessibilityLabel="Open modal"
        accessibilityRole="button"
        onPress={() => onClick(rowIndex)}
        style={{
          alignItems: "center",
          backgroundColor:
            alternateRowBackground && rowIndex % 2 === 1
              ? theme.surface.base
              : theme.surface.neutralLight,
          borderRadius: theme.radius.rounded,
          height: 32,
          justifyContent: "center",
          width: 32,
        }}
      >
        <Icon color="secondaryDark" iconName="info" size="md" />
      </Pressable>
    </View>
  );
};

interface DataTableHeaderCellProps {
  column: DataTableColumn;
  index: number;
  isPinnedHorizontal: boolean;
  isPinnedRow?: boolean;
  columnWidths: number[];
  sortColumn?: ColumnSortInterface;
  onSort: (index: number) => void;
  rowHeight: number;
  headerHeight?: number;
}

const DataTableHeaderCell: FC<DataTableHeaderCellProps> = ({
  column,
  index,
  isPinnedHorizontal,
  columnWidths,
  sortColumn,
  onSort,
  rowHeight,
  headerHeight,
}) => {
  const {theme} = useTheme();
  const sort = sortColumn?.column === index ? sortColumn.direction : undefined;

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.surface.base,
        borderBottomColor: theme.border.default,
        borderBottomWidth: 1,
        flexDirection: "row",
        height: headerHeight ?? rowHeight,
        justifyContent: "space-between",
        padding: 16,
        width: column.width,
        ...(isPinnedHorizontal && {
          left: columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0),
          position: "absolute",
          zIndex: 10 - index,
        }),
      }}
    >
      {Boolean(column.title) && <TableTitle align="left" title={column.title!} />}
      <View style={{alignItems: "center", flexDirection: "row"}}>
        {column.infoModalText && (
          <InfoModalIcon infoModalChildren={<Markdown>{column.infoModalText}</Markdown>} />
        )}
        {column.sortable && (
          <Pressable hitSlop={16} onPress={() => onSort(index)}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: sort ? theme.surface.primary : theme.surface.neutralLight,
                borderRadius: theme.radius.rounded,
                height: 16,
                justifyContent: "center",
                marginLeft: 8,
                width: 16,
              }}
            >
              <FontAwesome6
                color={theme.text.inverted}
                name={
                  sort === "asc" ? "arrow-down" : sort === "desc" ? "arrow-up" : "arrows-up-down"
                }
                selectable={undefined}
                size={10}
                solid
              />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
};

interface DataTableHeaderProps {
  columns: DataTableColumn[];
  hasMoreContent: boolean;
  pinnedColumns: number;
  columnWidths: number[];
  headerScrollRef: React.RefObject<ScrollView | null>;
  sortColumn?: ColumnSortInterface;
  onSort: (index: number) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>, isHeader: boolean) => void;
  rowHeight: number;
  headerHeight?: number;
}

const DataTableHeader: FC<DataTableHeaderProps> = ({
  columns,
  hasMoreContent,
  pinnedColumns,
  columnWidths,
  headerScrollRef,
  sortColumn,
  onSort,
  onScroll,
  rowHeight,
  headerHeight,
}) => {
  const {theme} = useTheme();

  return (
    <View style={{flexDirection: "row", position: "relative"}}>
      {/* Fixed-width container for "more" content button if present */}
      {hasMoreContent && (
        <View
          style={{
            backgroundColor: theme.surface.base,
            borderBottomColor: theme.border.default,
            borderBottomWidth: 1,
            height: headerHeight ?? rowHeight,
            width: 48,
            zIndex: 11,
          }}
        />
      )}

      {/* Container for pinned header columns - stays fixed during horizontal scroll */}
      {pinnedColumns > 0 && (
        <View
          style={{
            // Offset left position if there's a "more" content button
            left: hasMoreContent ? 48 : 0,
            position: "absolute",
            top: 0,
            zIndex: 10,
          }}
        >
          {columns.slice(0, pinnedColumns).map((column, index) => (
            <DataTableHeaderCell
              column={column}
              columnWidths={columnWidths}
              headerHeight={headerHeight}
              index={index}
              isPinnedHorizontal
              key={`pinned-header-${index}`}
              onSort={onSort}
              rowHeight={rowHeight}
              sortColumn={sortColumn}
            />
          ))}
        </View>
      )}

      {/* Scrollable container for non-pinned header columns */}
      <ScrollView
        horizontal
        onScroll={(e) => onScroll(e, true)}
        ref={headerScrollRef}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={{
          // Offset scrollable area by total width of pinned columns
          marginLeft: columnWidths.slice(0, pinnedColumns).reduce((sum, width) => sum + width, 0),
        }}
      >
        {columns.slice(pinnedColumns).map((column, index) => (
          <DataTableHeaderCell
            column={column}
            columnWidths={columnWidths}
            headerHeight={headerHeight}
            index={index + pinnedColumns}
            isPinnedHorizontal={false}
            key={`scrollable-header-${index + pinnedColumns}`}
            onSort={onSort}
            rowHeight={rowHeight}
            sortColumn={sortColumn}
          />
        ))}
      </ScrollView>
    </View>
  );
};

interface DataTableContentProps {
  data: any[][];
  columns: DataTableColumn[];
  pinnedColumns: number;
  alternateRowBackground: boolean;
  columnWidths: number[];
  bodyScrollRef: React.RefObject<ScrollView | null>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>, isHeader: boolean) => void;
  moreContentComponent?: React.ComponentType<{
    column: DataTableColumn;
    rowData: any[];
    rowIndex: number;
  }>;
  // Extra props to pass to the more modal, one per row.
  moreContentExtraData?: any[];
  moreContentSize?: "sm" | "md" | "lg";
  customColumnComponentMap?: DataTableCustomComponentMap;
  rowHeight: number;
}

const DataTableContent: FC<DataTableContentProps> = ({
  data,
  columns,
  pinnedColumns,
  alternateRowBackground,
  columnWidths,
  bodyScrollRef,
  onScroll,
  customColumnComponentMap,
  moreContentComponent: MoreContentContent,
  moreContentExtraData,
  moreContentSize = "md",
  rowHeight,
}) => {
  const [modalRow, setModalRow] = useState<number | null>(null);
  const {theme} = useTheme();

  return (
    <>
      <ScrollView style={{flex: 1}}>
        <View
          style={{
            flexDirection: "row",
            position: "relative",
          }}
        >
          {/* Fixed-width container for "more" content button if present */}
          {Boolean(MoreContentContent) && (
            <View
              style={{
                backgroundColor: theme.surface.base,
                left: 0,
                position: "absolute",
                top: 0,
                width: 48,
                zIndex: 1,
              }}
            >
              {data.map((_, rowIndex) => (
                <MoreButtonCell
                  alternateRowBackground={alternateRowBackground}
                  column={columns[0]}
                  key={`expand-${rowIndex}`}
                  onClick={setModalRow}
                  rowHeight={rowHeight}
                  rowIndex={rowIndex}
                />
              ))}
            </View>
          )}

          {/* Container for pinned rows - stays fixed during horizontal scroll */}
          {pinnedColumns > 0 && (
            <View
              style={{
                left: MoreContentContent ? 48 : 0,
                position: "absolute",
                top: 0,
                zIndex: 10,
              }}
            >
              {data.map((row, rowIndex) => (
                <DataTableRow
                  alternateRowBackground={alternateRowBackground}
                  columns={columns.slice(0, pinnedColumns)}
                  columnWidths={columnWidths}
                  customColumnComponentMap={customColumnComponentMap}
                  key={`pinned-${rowIndex}`}
                  pinnedColumns={pinnedColumns}
                  rowData={row.slice(0, pinnedColumns)}
                  rowHeight={rowHeight}
                  rowIndex={rowIndex}
                />
              ))}
            </View>
          )}

          {/* Scrollable container for non-pinned rows */}
          <ScrollView
            horizontal
            onScroll={(e) => onScroll(e, false)}
            ref={bodyScrollRef}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator
            style={{
              flex: 1,
              marginLeft:
                columnWidths.slice(0, pinnedColumns).reduce((sum, width) => sum + width, 0) +
                (MoreContentContent ? 48 : 0),
            }}
          >
            <View>
              {data.map((row, rowIndex) => (
                <DataTableRow
                  alternateRowBackground={alternateRowBackground}
                  columns={columns.slice(pinnedColumns)}
                  columnWidths={columnWidths}
                  customColumnComponentMap={customColumnComponentMap}
                  key={`scrollable-${rowIndex}`}
                  pinnedColumns={0}
                  rowData={row.slice(pinnedColumns)}
                  rowHeight={rowHeight}
                  rowIndex={rowIndex}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {MoreContentContent && (
        <Modal
          onDismiss={() => setModalRow(null)}
          size={moreContentSize}
          visible={modalRow !== null}
        >
          <MoreContentContent
            column={columns[0]}
            rowData={data[modalRow!]}
            rowIndex={modalRow!}
            {...(moreContentExtraData?.[modalRow!] ?? {})}
          />
        </Modal>
      )}
    </>
  );
};

export const DataTable: FC<DataTableProps> = ({
  data,
  columns,
  alternateRowBackground = true,
  totalPages = 1,
  page = 0,
  setPage,
  pinnedColumns = 0,
  sortColumn,
  setSortColumn,
  moreContentComponent,
  moreContentExtraData,
  customColumnComponentMap,
  rowHeight = 54,
  headerHeight,
  defaultTextSize = "md",
}) => {
  const {theme} = useTheme();
  const headerScrollRef = useRef<ScrollView>(null);
  const bodyScrollRef = useRef<ScrollView>(null);

  const columnWidths = useMemo(() => columns.map((col) => col.width), [columns]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>, isHeader: boolean) => {
      const scrollX = event.nativeEvent.contentOffset.x;
      if (isHeader && bodyScrollRef.current) {
        bodyScrollRef.current.scrollTo({animated: false, x: scrollX});
      } else if (!isHeader && headerScrollRef.current) {
        headerScrollRef.current.scrollTo({animated: false, x: scrollX});
      }
    },
    []
  );

  const handleSort = useCallback(
    (columnIndex: number) => {
      if (!setSortColumn || !columns[columnIndex].sortable) {
        return;
      }

      if (sortColumn?.column === columnIndex) {
        if (sortColumn.direction === "asc") {
          setSortColumn({
            column: columnIndex,
            direction: "desc",
          });
        } else {
          setSortColumn(undefined);
        }
      } else {
        setSortColumn({
          column: columnIndex,
          direction: "asc",
        });
      }
    },
    [sortColumn, setSortColumn, columns]
  );

  const processedData = useMemo(() => {
    return data.map((row) =>
      row.map((cell) => ({
        ...cell,
        textSize: cell.textSize || defaultTextSize,
      }))
    );
  }, [data, defaultTextSize]);

  return (
    <View style={{display: "flex", flexDirection: "column", height: "100%"}}>
      <View
        style={{
          borderColor: theme.border.default,
          borderWidth: 1,
          flex: 1,
          height: "100%",
          minHeight: 0,
        }}
      >
        <DataTableHeader
          columns={columns}
          columnWidths={columnWidths}
          hasMoreContent={Boolean(moreContentComponent)}
          headerHeight={headerHeight}
          headerScrollRef={headerScrollRef}
          onScroll={handleScroll}
          onSort={handleSort}
          pinnedColumns={pinnedColumns}
          rowHeight={rowHeight}
          sortColumn={sortColumn}
        />

        <View style={{flex: 1, minHeight: 0}}>
          <DataTableContent
            alternateRowBackground={alternateRowBackground}
            bodyScrollRef={bodyScrollRef}
            columns={columns}
            columnWidths={columnWidths}
            customColumnComponentMap={customColumnComponentMap}
            data={processedData}
            moreContentComponent={moreContentComponent}
            moreContentExtraData={moreContentExtraData}
            onScroll={handleScroll}
            pinnedColumns={pinnedColumns}
            rowHeight={rowHeight}
          />
        </View>
      </View>

      {Boolean(setPage && totalPages > 1) && (
        <View
          style={{
            alignItems: "center",
            height: 60,
            padding: 16,
          }}
        >
          <Pagination page={page} setPage={setPage!} totalPages={totalPages} />
        </View>
      )}
    </View>
  );
};
