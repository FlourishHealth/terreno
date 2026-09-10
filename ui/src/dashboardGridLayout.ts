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
