import {describe, expect, it} from "bun:test";

import {getDashboardCellWidth} from "./dashboardGridLayout";

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
