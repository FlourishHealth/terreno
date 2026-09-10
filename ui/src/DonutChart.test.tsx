import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {DonutChart} from "./DonutChart";
import {renderWithTheme} from "./test-utils";

const POINTS = [
  {label: "A", value: 50},
  {color: "#112233", label: "B", value: 50},
];

describe("DonutChart", () => {
  it("renders one mark testID per slice", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <DonutChart data={POINTS} testID="chart" />
    );

    expect(getByTestId("chart.point.0-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.1-clickable")).toBeTruthy();
    expect(queryByTestId("chart.point.2-clickable")).toBeNull();
  });

  it("shows emptyText when data is empty", () => {
    const {getByText} = renderWithTheme(<DonutChart data={[]} emptyText="Nothing yet" />);

    expect(getByText("Nothing yet")).toBeTruthy();
  });

  it("renders a legend row per slice and ignores legendLabel", () => {
    const {getByText, queryByText} = renderWithTheme(
      <DonutChart data={POINTS} legendLabel="Should hide" />
    );

    expect(getByText("A")).toBeTruthy();
    expect(getByText("B")).toBeTruthy();
    expect(queryByText("Should hide")).toBeNull();
  });

  it("shows tooltip copy after pressing a slice mark", async () => {
    const {getByTestId, getByText} = renderWithTheme(<DonutChart data={POINTS} testID="chart" />);

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.1-clickable"));
    });

    expect(getByText("B: 50")).toBeTruthy();
  });
});
