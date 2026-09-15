import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {Box} from "./Box";
import {getSpacing} from "./Common";
import {DashboardGrid} from "./DashboardGrid";
import {getDashboardCellWidth} from "./dashboardGridLayout";
import {renderWithTheme} from "./test-utils";

describe("DashboardGrid", () => {
  it("keeps child testIDs", () => {
    const {getByTestId} = renderWithTheme(
      <DashboardGrid testID="grid">
        <Box testID="tile-a">A</Box>
        <Box testID="tile-b">B</Box>
      </DashboardGrid>
    );

    expect(getByTestId("grid")).toBeTruthy();
    expect(getByTestId("tile-a")).toBeTruthy();
    expect(getByTestId("tile-b")).toBeTruthy();
  });

  it("renders custom gap without dropping children", () => {
    const {getByTestId} = renderWithTheme(
      <DashboardGrid columns={{lg: 3, md: 2, sm: 1}} gap={2} testID="grid">
        <Box testID="only">One</Box>
      </DashboardGrid>
    );

    expect(getByTestId("only")).toBeTruthy();
  });

  it("sizes cells so column widths plus gap fit the measured row", async () => {
    const {getByTestId} = renderWithTheme(
      <DashboardGrid columns={{lg: 3, md: 3, sm: 3}} gap={4} testID="grid">
        <Box testID="tile-a">A</Box>
        <Box testID="tile-b">B</Box>
        <Box testID="tile-c">C</Box>
      </DashboardGrid>
    );

    await act(async () => {
      fireEvent(getByTestId("grid"), "layout", {
        nativeEvent: {layout: {height: 80, width: 332}},
      });
    });

    const expectedWidth = getDashboardCellWidth({
      columnCount: 3,
      gapPx: getSpacing(4),
      rowWidth: 332,
    });
    expect(getByTestId("grid.cell.0").props.style).toMatchObject({
      maxWidth: expectedWidth,
      width: expectedWidth,
    });
  });
});
