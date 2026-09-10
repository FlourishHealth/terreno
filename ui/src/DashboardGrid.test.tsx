import {describe, expect, it} from "bun:test";

import {Box} from "./Box";
import {DashboardGrid} from "./DashboardGrid";
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
});
