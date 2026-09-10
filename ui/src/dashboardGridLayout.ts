export const getDashboardCellWidth = ({
  columnCount,
  gapPx,
  rowWidth,
}: {
  columnCount: number;
  gapPx: number;
  rowWidth: number;
}): number => {
  if (columnCount <= 1) {
    return Math.max(rowWidth, 0);
  }
  if (rowWidth <= 0) {
    return 0;
  }

  const gapTotal = gapPx * (columnCount - 1);
  return Math.max((rowWidth - gapTotal) / columnCount, 0);
};

export const getDashboardCellBoxStyle = ({
  columnCount,
  gapPx,
  rowWidth,
}: {
  columnCount: number;
  gapPx: number;
  rowWidth: number;
}): {
  flexGrow: 0;
  flexShrink: 0;
  maxWidth: number | string;
  width: number | string;
} => {
  if (rowWidth > 0) {
    const width = getDashboardCellWidth({columnCount, gapPx, rowWidth});
    return {flexGrow: 0, flexShrink: 0, maxWidth: width, width};
  }
  if (columnCount <= 1) {
    return {flexGrow: 0, flexShrink: 0, maxWidth: "100%", width: "100%"};
  }
  const width = `calc((100% - ${gapPx * (columnCount - 1)}px) / ${columnCount})`;
  return {flexGrow: 0, flexShrink: 0, maxWidth: width, width};
};
