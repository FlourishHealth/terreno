import {afterEach, describe, expect, it} from "bun:test";
import {Platform} from "react-native";

import {getDashboardCellBoxStyle, getDashboardCellWidth} from "./dashboardGridLayout";

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
});

describe("getDashboardCellWidth", () => {
  it("subtracts inter-column gap so three cells fit the row", () => {
    expect(
      getDashboardCellWidth({
        columnCount: 3,
        gapPx: 16,
        rowWidth: 332,
      })
    ).toBe(100);
  });

  it("floors fractional widths so the row still fits every column", () => {
    const columnCount = 3;
    const gapPx = 16;
    const rowWidth = 333;
    const width = getDashboardCellWidth({columnCount, gapPx, rowWidth});

    expect(width).toBe(100);
    expect(width * columnCount + gapPx * (columnCount - 1)).toBeLessThanOrEqual(rowWidth);
  });

  it("uses the full row width for a single column", () => {
    expect(
      getDashboardCellWidth({
        columnCount: 1,
        gapPx: 16,
        rowWidth: 320,
      })
    ).toBe(320);
  });
});

describe("getDashboardCellBoxStyle", () => {
  it("uses calc that subtracts gap before the row is measured on web", () => {
    Platform.OS = "web";

    expect(
      getDashboardCellBoxStyle({
        columnCount: 3,
        gapPx: 16,
        rowWidth: 0,
      }).width
    ).toBe("calc((100% - 32px) / 3)");
  });

  it("falls back to a full-width cell on native, which has no calc", () => {
    Platform.OS = "ios";

    expect(
      getDashboardCellBoxStyle({
        columnCount: 3,
        gapPx: 16,
        rowWidth: 0,
      }).width
    ).toBe("100%");
  });

  it("pins whole-pixel widths once the row is measured", () => {
    Platform.OS = "web";

    expect(
      getDashboardCellBoxStyle({
        columnCount: 3,
        gapPx: 16,
        rowWidth: 333,
      })
    ).toEqual({flexGrow: 0, flexShrink: 0, maxWidth: 100, width: 100});
  });
});
